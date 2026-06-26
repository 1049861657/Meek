import { createHash } from 'node:crypto';

import {
  HindsightClient,
  HindsightError,
  type RecallResponse,
} from '@vectorize-io/hindsight-client';

import { logMemoryRecallAudit } from '../audit.js';
import {
  isHindsightMemoryConfigured,
  MemoryConfig,
} from '../config/feature-config.js';
import { Logger } from '../lib/logger.js';
import type { ChannelId } from '@meek/shared';

const RECALL_LOG_TEXT_MAX = 300;

const MEMORY_SECTION_PREFIX =
  '## 跨会话记忆\n\n' +
  '以下内容来自以往会话：长期**归纳观察**（多事实综合后的巩固知识）与**世界事实**（客观第三人称陈述）。' +
  '文首摘要（若有）为更高优先级的长期偏好汇总。\n\n' +
  '使用规则：\n' +
  '- **当前会话优先**：任务进度、工作目录、工具返回的实时结果，以本会话上下文为准。\n' +
  '- **矛盾时**：优先采纳写明状态演变（「曾为 X，现为 Y」）的条目；其余以本会话用户最新表述为准。\n' +
  '- **按需引用**：仅在与当前问题相关时采用；无关条目可忽略。\n' +
  '- **类型说明**：「归纳观察」为综合结论；「世界事实」为单条客观记录，二者可重叠，以归纳观察为准。';

const RECALL_TYPE_LABELS: Record<string, string> = {
  observation: '归纳观察（长期偏好与模式）',
  world: '世界事实（客观信息与事件）',
  experience: '代理经历（助手侧行为记录）',
};

const USER_PREFERENCES_MENTAL_MODEL_ID = 'user-preferences';

let client: HindsightClient | null = null;
const ensuredBanks = new Set<string>();
const syncedBankConfigKeys = new Map<string, string>();

function parseMcpClientRootPathsFromEnv(): string[] {
  const raw = process.env.MCP_CLIENT_ROOTS?.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(/[;,]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function resolveBankConfigSyncKey(): string {
  return [
    MemoryConfig.retainMission,
    MemoryConfig.observationsMission,
    MemoryConfig.retainExtractionMode,
  ].join('\x1e');
}

export function getHindsightClient(): HindsightClient | null {
  if (!isHindsightMemoryConfigured()) {
    return null;
  }
  if (!client) {
    client = new HindsightClient({
      baseUrl: MemoryConfig.baseUrl,
      ...(MemoryConfig.apiKey ? { apiKey: MemoryConfig.apiKey } : {}),
      userAgent: 'meek-harness/1.0',
    });
  }
  return client;
}

function formatHindsightError(error: unknown): string {
  if (error instanceof HindsightError) {
    const code = error.statusCode !== undefined ? ` status=${error.statusCode}` : '';
    return `${error.message}${code}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function formatRecallResultsForPrompt(response: RecallResponse): string {
  if (!response.results?.length) {
    return '';
  }

  const grouped = new Map<string, string[]>();
  for (const result of response.results) {
    const type = result.type ?? 'unknown';
    const texts = grouped.get(type) ?? [];
    const text = result.text?.trim();
    if (text) {
      texts.push(text);
    }
    grouped.set(type, texts);
  }

  const sections: string[] = [];
  for (const [type, texts] of grouped) {
    if (texts.length === 0) {
      continue;
    }
    const label = RECALL_TYPE_LABELS[type] ?? type;
    const bullets = texts.map((text) => `- ${text}`).join('\n');
    sections.push(`### ${label}\n${bullets}`);
  }

  return sections.join('\n\n');
}

function toRecallAuditResults(response: RecallResponse): Array<{ type: string; text: string }> {
  return (response.results ?? []).map((result) => ({
    type: result.type ?? 'unknown',
    text: (result.text ?? '').trim().slice(0, RECALL_LOG_TEXT_MAX),
  }));
}

function emitMemoryRecallLog(entry: {
  requestId?: string;
  bankId: string;
  query: string;
  skipped: boolean;
  skipReason?: string;
  resultCount: number;
  results: Array<{ type: string; text: string }>;
}): void {
  const requestId = entry.requestId?.trim();
  if (!requestId) {
    return;
  }

  logMemoryRecallAudit({
    requestId,
    bankId: entry.bankId,
    query: entry.query,
    skipped: entry.skipped,
    skipReason: entry.skipReason,
    resultCount: entry.resultCount,
    results: entry.results,
  });
}

export function logMemoryRecallSkipped(
  requestId: string | undefined,
  options: { bankId: string; query: string; reason: string }
): void {
  emitMemoryRecallLog({
    requestId,
    bankId: options.bankId,
    query: options.query,
    skipped: true,
    skipReason: options.reason,
    resultCount: 0,
    results: [],
  });
}

function resolveRetainDocumentId(documentSessionId?: string): string | undefined {
  const sessionId = documentSessionId?.trim();
  if (!sessionId) {
    return undefined;
  }
  const hash = createHash('sha256').update(sessionId).digest('hex').slice(0, 16);
  return `meek-session-${hash}`;
}

let cachedMemoryPathScope: string | undefined;

function getMemoryPathScope(): string {
  if (cachedMemoryPathScope === undefined) {
    const roots = parseMcpClientRootPathsFromEnv();
    cachedMemoryPathScope = roots.length > 0 ? roots[0]! : 'default';
  }
  return cachedMemoryPathScope;
}

function hashBankSegment(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

export function resolveHindsightBankId(channel: ChannelId | string, scopeKey: string): string {
  return `${MemoryConfig.bankIdPrefix}-${channel}-${hashBankSegment(`${scopeKey}\x1e${getMemoryPathScope()}`)}`;
}

async function syncBankRetainConfig(bankId: string, signal?: AbortSignal): Promise<void> {
  const hindsight = getHindsightClient();
  if (!hindsight) {
    return;
  }

  try {
    await hindsight.updateBankConfig(bankId, {
      retainMission: MemoryConfig.retainMission,
      observationsMission: MemoryConfig.observationsMission,
      retainExtractionMode: MemoryConfig.retainExtractionMode,
      signal,
    });
  } catch (error) {
    Logger.warn(
      'MEMORY',
      `updateBankConfig(${bankId}) failed: ${formatHindsightError(error)}`
    );
  }
}

export async function ensureHindsightBank(bankId: string, signal?: AbortSignal): Promise<void> {
  const configSyncKey = resolveBankConfigSyncKey();
  if (ensuredBanks.has(bankId) && syncedBankConfigKeys.get(bankId) === configSyncKey) {
    return;
  }

  const hindsight = getHindsightClient();
  if (!hindsight) {
    return;
  }

  let bankExists = false;
  try {
    await hindsight.getBankProfile(bankId, { signal });
    bankExists = true;
  } catch {
    // bank 可能尚未创建
  }

  if (!bankExists) {
    try {
      await hindsight.createBank(bankId, {
        reflectMission:
          'You are a helpful assistant. Use stored preferences and project conventions when relevant.',
        signal,
      });
    } catch (error) {
      if (
        !(error instanceof HindsightError && (error.statusCode === 409 || error.statusCode === 400))
      ) {
        Logger.warn('MEMORY', `createBank(${bankId}) failed: ${formatHindsightError(error)}`);
        return;
      }
    }
  }

  await syncBankRetainConfig(bankId, signal);
  ensuredBanks.add(bankId);
  syncedBankConfigKeys.set(bankId, configSyncKey);
}

async function fetchUserPreferencesMentalModelForPrompt(
  bankId: string,
  signal?: AbortSignal
): Promise<string> {
  const hindsight = getHindsightClient();
  if (!hindsight) {
    return '';
  }

  try {
    const model = await hindsight.getMentalModel(bankId, USER_PREFERENCES_MENTAL_MODEL_ID, {
      signal,
    });
    const content = (model.content ?? '').trim();
    if (!content) {
      return '';
    }
    return content;
  } catch (error) {
    if (!(error instanceof HindsightError && error.statusCode === 404)) {
      Logger.warn(
        'MEMORY',
        `getMentalModel(${USER_PREFERENCES_MENTAL_MODEL_ID}) failed: ${formatHindsightError(error)}`
      );
    }
    return '';
  }
}

export async function recallForPrompt(
  bankId: string,
  query: string,
  options?: { signal?: AbortSignal; requestId?: string }
): Promise<string> {
  const signal = options?.signal;
  const trimmedQuery = query.trim();
  const hindsight = getHindsightClient();
  if (!hindsight || !trimmedQuery) {
    return '';
  }

  try {
    await ensureHindsightBank(bankId, signal);
    const [mentalModelSection, response] = await Promise.all([
      fetchUserPreferencesMentalModelForPrompt(bankId, signal),
      hindsight.recall(bankId, trimmedQuery, {
        budget: 'mid',
        maxTokens: MemoryConfig.recallMaxTokens,
        types: [...MemoryConfig.recallTypes],
        signal,
      }),
    ]);

    const auditResults = toRecallAuditResults(response);
    emitMemoryRecallLog({
      requestId: options?.requestId,
      bankId,
      query: trimmedQuery,
      skipped: false,
      resultCount: auditResults.length,
      results: auditResults,
    });

    const recallBody = formatRecallResultsForPrompt(response).trim();
    const sections = [mentalModelSection, recallBody].filter((part) => part.length > 0);
    if (sections.length === 0) {
      return '';
    }
    return `${MEMORY_SECTION_PREFIX}\n\n${sections.join('\n\n')}`;
  } catch (error) {
    Logger.warn('MEMORY', `recall(${bankId}) failed: ${formatHindsightError(error)}`);
    return '';
  }
}

export async function retainConversation(
  bankId: string,
  content: string,
  options: {
    requestId?: string;
    documentSessionId?: string;
    conversationStartedAt?: string;
    signal?: AbortSignal;
  } = {}
): Promise<void> {
  const hindsight = getHindsightClient();
  if (!hindsight || !content.trim()) {
    return;
  }

  const documentId = resolveRetainDocumentId(options.documentSessionId);

  try {
    await ensureHindsightBank(bankId, options.signal);
    await hindsight.retain(bankId, content, {
      async: true,
      context: MemoryConfig.retainContext,
      timestamp: options.conversationStartedAt ?? new Date().toISOString(),
      ...(documentId ? { documentId, updateMode: 'append' as const } : {}),
      ...(options.requestId ? { metadata: { requestId: options.requestId } } : {}),
      signal: options.signal,
    });
    Logger.info(
      'MEMORY',
      `retain queued bank=${bankId} chars=${content.length}` +
        (documentId ? ` documentId=${documentId} mode=append` : '')
    );
  } catch (error) {
    Logger.warn('MEMORY', `retain(${bankId}) failed: ${formatHindsightError(error)}`);
  }
}
