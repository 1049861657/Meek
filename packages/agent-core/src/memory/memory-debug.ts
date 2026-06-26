import { HindsightError, type RecallResult, type ReflectResponse } from '@vectorize-io/hindsight-client';

import { isHindsightMemoryConfigured, MemoryConfig } from '../config/feature-config.js';
import type { MemoryIdentityScope } from '@meek/shared';
import type {
  MemoryDebugMetaPayload,
  MemoryDebugPromptPayload,
  MemoryDebugRecallItem,
  MemoryDebugRecallPayload,
  MemoryDebugReflectPayload,
  MemoryDebugReflectReference,
} from '../types/memory-debug.types.js';
import {
  ensureHindsightBank,
  getHindsightClient,
  recallForPrompt,
} from './hindsight-memory-provider.js';
import { resolveMemoryBankId } from '../memory-pipeline-context.js';

export class MemoryDebugUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MemoryDebugUnavailableError';
  }
}

export function getMemoryDebugMeta(scope?: MemoryIdentityScope): MemoryDebugMetaPayload {
  const enabled = isHindsightMemoryConfigured();
  return {
    enabled,
    bankId: enabled ? resolveMemoryBankId(scope) ?? null : null,
  };
}

function resolveDebugContext(
  query: string,
  scope?: MemoryIdentityScope
): {
  bankId: string;
  trimmedQuery: string;
  hindsight: NonNullable<ReturnType<typeof getHindsightClient>>;
} {
  if (!isHindsightMemoryConfigured()) {
    throw new MemoryDebugUnavailableError('Hindsight 未配置');
  }
  const bankId = resolveMemoryBankId(scope);
  if (!bankId) {
    throw new MemoryDebugUnavailableError('登录后可用记忆调试');
  }
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    throw new Error('提问内容不能为空');
  }
  const hindsight = getHindsightClient();
  if (!hindsight) {
    throw new MemoryDebugUnavailableError('Hindsight 未配置');
  }
  return { bankId, trimmedQuery, hindsight };
}

function mapRecallItem(result: RecallResult): MemoryDebugRecallItem {
  return {
    id: result.id,
    type: result.type ?? 'unknown',
    text: (result.text ?? '').trim(),
    context: result.context ?? null,
    ...(result.entities?.length ? { entities: [...result.entities] } : {}),
    mentionedAt: result.mentioned_at ?? null,
  };
}

function mapReflectReferences(response: ReflectResponse): MemoryDebugReflectReference[] {
  return (response.based_on?.memories ?? [])
    .map((memory) => ({
      type: memory.type ?? 'unknown',
      text: (memory.text ?? '').trim(),
    }))
    .filter((item) => item.text.length > 0);
}

export async function debugRecall(
  query: string,
  options?: { signal?: AbortSignal; scope?: MemoryIdentityScope }
): Promise<MemoryDebugRecallPayload> {
  const { bankId, trimmedQuery, hindsight } = resolveDebugContext(query, options?.scope);
  const startedAt = Date.now();
  await ensureHindsightBank(bankId, options?.signal);
  const response = await hindsight.recall(bankId, trimmedQuery, {
    budget: 'mid',
    maxTokens: MemoryConfig.recallMaxTokens,
    types: [...MemoryConfig.recallTypes],
    signal: options?.signal,
  });

  return {
    bankId,
    query: trimmedQuery,
    durationMs: Date.now() - startedAt,
    results: (response.results ?? []).map(mapRecallItem),
  };
}

export async function debugPrompt(
  query: string,
  options?: { signal?: AbortSignal; scope?: MemoryIdentityScope }
): Promise<MemoryDebugPromptPayload> {
  const { bankId, trimmedQuery } = resolveDebugContext(query, options?.scope);
  const startedAt = Date.now();
  const content = await recallForPrompt(bankId, trimmedQuery, { signal: options?.signal });
  return {
    bankId,
    query: trimmedQuery,
    durationMs: Date.now() - startedAt,
    content,
    charCount: content.length,
    injected: content.trim().length > 0,
  };
}

export async function debugReflect(
  query: string,
  options?: { signal?: AbortSignal; scope?: MemoryIdentityScope }
): Promise<MemoryDebugReflectPayload> {
  const { bankId, trimmedQuery, hindsight } = resolveDebugContext(query, options?.scope);
  const startedAt = Date.now();
  await ensureHindsightBank(bankId, options?.signal);
  const response = await hindsight.reflect(bankId, trimmedQuery, {
    budget: 'mid',
    factTypes: [...MemoryConfig.recallTypes],
    signal: options?.signal,
  });

  return {
    bankId,
    query: trimmedQuery,
    durationMs: Date.now() - startedAt,
    text: (response.text ?? '').trim(),
    references: mapReflectReferences(response),
  };
}

export function formatMemoryDebugError(error: unknown): string {
  if (error instanceof MemoryDebugUnavailableError) {
    return error.message;
  }
  if (error instanceof HindsightError) {
    const code = error.statusCode !== undefined ? ` (${error.statusCode})` : '';
    return `${error.message}${code}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
