import { ContextConfig } from './config/feature-config.js';
import { Logger } from './lib/logger.js';
import { InternalMessage } from './types.js';
function formatMicroCompactPlaceholder(msg: InternalMessage): string {
  const artifact = msg._internal?.artifact;
  if (artifact) {
    return `[tool compacted · artifact ${artifact.toolCallId} · ${artifact.bytes} chars]`;
  }
  return '[tool compacted]';
}

/** 将消息 content 转为可计数字符串 */
function messageContentAsText(content: InternalMessage['content']): string {
  if (typeof content === 'string') {
    return content;
  }
  if (content === null || content === undefined) {
    return '';
  }
  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === 'object' && part !== null && 'text' in part) {
          return String((part as { text?: string }).text ?? '');
        }
        return '';
      })
      .join('');
  }
  return String(content);
}

/** 将消息 content 转为可计数字符串长度 */
function messageContentCharLength(msg: InternalMessage): number {
  return messageContentAsText(msg.content).length;
}

const CJK_CHAR_RE =
  /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/u;

function isCjkChar(ch: string): boolean {
  return CJK_CHAR_RE.test(ch);
}

/** 按中英文混排加权估算单段文本 token（无 API 时的启发式） */
export function estimateTextTokens(text: string): number {
  if (!text || text.length === 0) {
    return 0;
  }
  let cjkChars = 0;
  let otherChars = 0;
  for (const ch of text) {
    if (isCjkChar(ch)) {
      cjkChars++;
    } else {
      otherChars++;
    }
  }
  const cjkPerToken = ContextConfig.charsPerTokenCjk;
  const latinPerToken = ContextConfig.charsPerTokenLatin;
  const tokens =
    cjkChars / cjkPerToken + otherChars / latinPerToken;
  return Math.max(1, Math.ceil(tokens));
}

function estimateSingleMessageTokens(msg: InternalMessage): number {
  const text = messageContentAsText(msg.content);
  const len = text.length;
  let total = len > 0 ? estimateTextTokens(text) : 0;

  if (msg.role === 'assistant' && 'tool_calls' in msg && Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      if (tc.type === 'function' && 'function' in tc) {
        total += estimateTextTokens(tc.function.arguments ?? '');
        total += estimateTextTokens(tc.function.name ?? '');
      }
    }
  }
  return Math.max(total, len > 0 ? 1 : 0);
}

/**
 * 启发式 token 估算（中文按 CJK 1 字/token，英文约 4 字/token 加权）
 */
export function estimateTokenCount(messages: readonly InternalMessage[]): number {
  if (messages.length === 0) {
    return 1;
  }
  let sum = 0;
  for (const msg of messages) {
    sum += estimateSingleMessageTokens(msg);
  }
  return Math.max(1, sum);
}

export interface ContextBudgetLogOptions {
  requestId?: string;
  round?: number;
  phase?: 'before_llm' | 'after_compact';
}

/**
 * 输出上下文 budget 日志（验收 P1-01-01）
 */
export function logContextBudget(
  messages: readonly InternalMessage[],
  estimatedTokens: number,
  options: ContextBudgetLogOptions = {}
): void {
  const toolCount = messages.filter(m => m.role === 'tool').length;
  const compactedCount = messages.filter(m => m._source === 'compact').length;
  const phase = options.phase ?? 'before_llm';
  Logger.info(
    'CONTEXT',
    `budget [${phase}] requestId=${options.requestId ?? '-'} round=${options.round ?? '-'} ` +
      `messages=${messages.length} tool=${toolCount} compacted=${compactedCount} ` +
      `estimatedTokens=${estimatedTokens} threshold=${ContextConfig.compactThresholdTokens}`
  );
}

/** 已手动/自动应用、带 [上下文摘要] 前缀的用户消息 */
export function isContextSummaryMessage(msg: InternalMessage): boolean {
  return (
    msg.role === 'user' &&
    typeof msg.content === 'string' &&
    msg.content.startsWith('[上下文摘要]')
  );
}

export function hasAppliedContextSummary(messages: readonly InternalMessage[]): boolean {
  return messages.some(isContextSummaryMessage);
}

/** 仅统计被 microCompact 占位过的 tool 消息（不含摘要 user 消息） */
function countCompactedToolMessages(messages: readonly InternalMessage[]): number {
  return messages.filter(m => m.role === 'tool' && m._source === 'compact').length;
}

/**
 * 微压缩：仅保留最近 N 条完整 tool 结果（P1-01-03）
 */
export function microCompact(
  messages: InternalMessage[],
  keepRecent: number = ContextConfig.microCompactKeepRecent
): void {
  const toolIndices: number[] = [];
  for (let i = 0; i < messages.length; i++) {
    const item = messages[i];
    if (item?.role === 'tool') {
      toolIndices.push(i);
    }
  }
  if (toolIndices.length <= keepRecent) {
    return;
  }

  const toCompact = toolIndices.slice(0, toolIndices.length - keepRecent);
  for (const idx of toCompact) {
    const msg = messages[idx];
    if (!msg || msg._source === 'compact') {
      continue;
    }
    msg.content = formatMicroCompactPlaceholder(msg);
    msg._source = 'compact';
  }
}

/** 上下文预览（P1-01-06，无 LLM） */
export interface ContextMessageSummary {
  index: number;
  role: string;
  charLength: number;
  estimatedTokens: number;
  preview: string;
}

export interface ContextPreviewResult {
  messageCount: number;
  roleCounts: Record<string, number>;
  estimatedTokens: number;
  compactThresholdTokens: number;
  compactedToolCount: number;
  messages: ContextMessageSummary[];
  /** POST messages 的 content 字符总和（与 /compact 日志 inputChars 一致） */
  incomingContentChars: number;
  /** 是否会在 applyContextBeforeLlm 触发 LLM 摘要（与手动 compact 同一条 compactHistory） */
  wouldAutoCompact: boolean;
  /** 将触发自动摘要但尚无已应用摘要，预览无法展示 LLM 终态正文 */
  pendingAutoCompact: boolean;
  /** 已使用 apiContextOverride，下列表即 POST 正文 */
  contextOverrideActive: boolean;
  /** 触发自动摘要时，送入压缩模型的 prompt 字符数（与 compact 日志 promptChars 同源） */
  compactPromptChars?: number;
}

export interface MainModelContextPreviewOptions {
  enableAutoCompact: boolean;
  contextOverride?: readonly InternalMessage[] | null;
}

const PREVIEW_TEXT_LIMIT = 0;

function cloneMessages(messages: readonly InternalMessage[]): InternalMessage[] {
  return JSON.parse(JSON.stringify(messages)) as InternalMessage[];
}

function contentPreview(content: unknown): string {
  if (typeof content === 'string') {
    if (PREVIEW_TEXT_LIMIT <= 0 || content.length <= PREVIEW_TEXT_LIMIT) {
      return content;
    }
    return `${content.slice(0, PREVIEW_TEXT_LIMIT)}…`;
  }
  if (content === null || content === undefined) {
    return '';
  }
  const text = JSON.stringify(content);
  if (PREVIEW_TEXT_LIMIT <= 0 || text.length <= PREVIEW_TEXT_LIMIT) {
    return text;
  }
  return `${text.slice(0, PREVIEW_TEXT_LIMIT)}…`;
}

function sumIncomingContentChars(messages: readonly InternalMessage[]): number {
  let sum = 0;
  for (const m of messages) {
    if (typeof m.content === 'string') {
      sum += m.content.length;
    }
  }
  return sum;
}

function buildPreviewSummaries(working: readonly InternalMessage[]): {
  roleCounts: Record<string, number>;
  messages: ContextMessageSummary[];
} {
  const roleCounts: Record<string, number> = {};
  const summaries: ContextMessageSummary[] = [];

  for (let i = 0; i < working.length; i++) {
    const msg = working[i];
    if (!msg) {
      continue;
    }
    const role = msg.role ?? 'unknown';
    roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    const charLength = messageContentCharLength(msg);
    summaries.push({
      index: i,
      role,
      charLength,
      estimatedTokens: estimateSingleMessageTokens(msg),
      preview: contentPreview(msg.content)
    });
  }

  return { roleCounts, messages: summaries };
}

/**
 * 预览「下次主模型首轮」见到的 messages（对齐 applyContextBeforeLlm 后、formatMessages 之前）
 */
export function buildMainModelContextPreview(
  incoming: readonly InternalMessage[],
  options: MainModelContextPreviewOptions
): ContextPreviewResult {
  const incomingContentChars = sumIncomingContentChars(incoming);

  if (options.contextOverride?.length) {
    const working = cloneMessages(options.contextOverride);
    const { roleCounts, messages: summaries } = buildPreviewSummaries(working);
    return {
      messageCount: working.length,
      roleCounts,
      estimatedTokens: estimateTokenCount(working),
      compactThresholdTokens: ContextConfig.compactThresholdTokens,
      compactedToolCount: countCompactedToolMessages(working),
      messages: summaries,
      incomingContentChars,
      wouldAutoCompact: false,
      pendingAutoCompact: false,
      contextOverrideActive: true
    };
  }

  const snapshotForSummary = cloneMessages(incoming);
  const trailing: InternalMessage[] = [];
  const history = cloneMessages(incoming);
  while (history.length > 0 && history[history.length - 1]?.role === 'user') {
    trailing.unshift(history.pop()!);
  }

  microCompact(history);
  const historyWithTrailing = [...history, ...trailing];
  const estimated = estimateTokenCount(historyWithTrailing);
  const wouldAutoCompact =
    options.enableAutoCompact && estimated >= ContextConfig.compactThresholdTokens;
  const compactPromptChars = wouldAutoCompact
    ? buildCompactPromptFromMessages(snapshotForSummary).length
    : undefined;

  let finalMessages: InternalMessage[] = historyWithTrailing;
  let pendingAutoCompact = false;

  if (wouldAutoCompact) {
    pendingAutoCompact = true;
    finalMessages = [
      {
        role: 'user',
        content:
          '（发送时将自动执行与「生成摘要」相同的 compactHistory；' +
          '请先「生成摘要」并「应用到下次请求」以在此查看确切正文。）',
        _source: 'compact',
        _timestamp: new Date().toISOString()
      },
      ...trailing
    ];
  }

  const { roleCounts, messages: summaries } = buildPreviewSummaries(finalMessages);
  const compactedToolCount = countCompactedToolMessages(history);

  return {
    messageCount: finalMessages.length,
    roleCounts,
    estimatedTokens: estimateTokenCount(finalMessages),
    compactThresholdTokens: ContextConfig.compactThresholdTokens,
    compactedToolCount,
    messages: summaries,
    incomingContentChars,
    wouldAutoCompact,
    pendingAutoCompact,
    contextOverrideActive: false,
    compactPromptChars
  };
}

/**
 * 送摘要前截断过长 tool/assistant 文本（P1-01-09）
 */
/** 摘要前移除 reasoning_content，避免噪声与 token 浪费 */
export function stripReasoningFromMessages(messages: readonly InternalMessage[]): InternalMessage[] {
  return cloneMessages(messages).map(msg => {
    const { reasoning_content: _reasoning, ...rest } = msg;
    return rest;
  });
}

function formatToolCallsHint(msg: InternalMessage): string {
  if (msg.role !== 'assistant' || !Array.isArray(msg.tool_calls) || msg.tool_calls.length === 0) {
    return '';
  }
  const names = msg.tool_calls
    .filter(tc => tc.type === 'function' && 'function' in tc)
    .map(tc => tc.function.name)
    .filter((n): n is string => typeof n === 'string' && n.length > 0)
    .join(', ');
  return names.length > 0 ? ` tools=[${names}]` : '';
}

/** 将消息列表头部的 [上下文摘要] 与后续新增对话分离（再压缩时避免摘要被当作普通 user 气泡忽略） */
function splitLeadingSummaryMessages(messages: readonly InternalMessage[]): {
  priorSummaryText: string | null;
  conversationMessages: InternalMessage[];
} {
  const conversationMessages: InternalMessage[] = [];
  const priorParts: string[] = [];
  let stillLeading = true;

  for (const msg of messages) {
    if (stillLeading && isContextSummaryMessage(msg) && typeof msg.content === 'string') {
      const body = msg.content.replace(/^\[上下文摘要\]\s*\n?/, '').trim();
      if (body.length > 0) {
        priorParts.push(body);
      }
      continue;
    }
    stillLeading = false;
    conversationMessages.push(msg);
  }

  const priorSummaryText =
    priorParts.length > 0 ? priorParts.join('\n\n---\n\n') : null;
  return { priorSummaryText, conversationMessages };
}

function formatPriorSummarySection(priorSummaryText: string): string {
  const max = ContextConfig.summarizePriorSummaryMaxChars;
  const body =
    priorSummaryText.length <= max
      ? priorSummaryText
      : `${priorSummaryText.slice(0, max)}\n…(已有摘要过长已截断)`;
  return (
    '【已有上下文摘要】\n' +
    '（此前压缩结果；输出新摘要时必须合并保留其中目标、结论、文件与约束，不可只写后续新对话。）\n' +
    `${body}\n\n`
  );
}

/** 摘要输入用单行摘录（与面板 preview 的 240 字分离） */
function contentForSummaryLine(content: unknown, maxChars?: number): string {
  const max = maxChars ?? ContextConfig.summarizeToolContentMaxChars;
  if (typeof content === 'string') {
    const oneLine = content.replace(/\s+/g, ' ').trim();
    return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
  }
  if (content === null || content === undefined) {
    return '';
  }
  const text = JSON.stringify(content).replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export interface BuildSummaryPayloadOptions {
  /** 对话记录段落可用字符预算（不含 prompt 前缀与已有摘要段） */
  maxChars?: number;
}

/**
 * 将对话转为按序文本（使用 prepare 后的 content，单条最多 summarizeToolContentMaxChars）
 * 超预算时优先保留较新的条目（丢弃较早的 [0]… 行）
 */
export function buildSummaryPayload(
  messages: readonly InternalMessage[],
  options: BuildSummaryPayloadOptions = {}
): string {
  const maxTotal = options.maxChars ?? ContextConfig.summarizeInputMaxChars;
  const lines: string[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m) {
      continue;
    }
    const excerpt = contentForSummaryLine(m.content);
    lines.push(`[${i}] role=${m.role ?? 'unknown'}${formatToolCallsHint(m)}: ${excerpt}`);
  }

  while (lines.length > 0 && lines.join('\n').length > maxTotal) {
    lines.shift();
  }

  let joined = lines.join('\n');
  if (lines.length < messages.length) {
    joined += '\n…(较早对话记录已截断，已优先保留最新条目)';
  }
  return joined;
}

export function prepareMessagesForSummary(messages: readonly InternalMessage[]): InternalMessage[] {
  const max = ContextConfig.summarizeToolContentMaxChars;
  return cloneMessages(messages).map(msg => {
    if (typeof msg.content !== 'string' || msg.content.length <= max) {
      return msg;
    }
    if (msg.role === 'tool' || msg.role === 'assistant') {
      return {
        ...msg,
        content: `${msg.content.slice(0, max)}\n…(摘要输入已截断，原 ${msg.content.length} 字符)`
      };
    }
    return msg;
  });
}

/** 接续摘要提示词：直接 Markdown 三节，由 [上下文摘要] 前缀标记边界 */
const SUMMARY_PROMPT_PREFIX =
  '你正在为一段尚未完成的对话撰写「接续摘要」。下方记录将被本条摘要整体替换；' +
  '阅读者应能在没有原始历史的情况下继续同一话题。\n\n' +
  '【保留规则】\n' +
  '- 工具名、错误原文、关键专有名词：对话中出现则照抄（反引号包裹）\n' +
  '- 禁止编造对话中未出现的结论或用户诉求\n' +
  '- 纯问答、无工具调用时：「工具与错误」写「无」\n\n' +
  '【输出要求】\n' +
  '- 直接输出中文 Markdown，不要前言、不要 XML/HTML 标签\n' +
  '- 必须且仅包含下列二级标题；无内容写「无」\n\n' +
  '## 目标\n' +
  '用户核心诉求与约束；合并重复指令\n\n' +
  '## 已完成\n' +
  '已回答/已执行结果的要点（bullet）\n\n' +
  '## 工具与错误\n' +
  '工具调用及结果；失败写「工具名 + 错误原文」\n\n';

const SUMMARY_MERGE_PRIOR_HINT =
  '【重要】下方分为「已有上下文摘要」与「摘要后的新增对话」两段。' +
  '你必须把两段信息合并进一条新摘要，禁止只总结新增对话而丢弃已有摘要中的内容。\n\n';

const SUMMARY_CONVERSATION_HEADER = '【摘要后的新增对话】\n';

export interface CompactSummarizeResult {
  text: string;
  finishReason: string | null;
}

/**
 * LLM 摘要压缩，替换为单条 user 消息（P1-01-04）
 */
/** 手动 / 自动摘要共用的 prompt 构建（同一套 strip → prepare → payload） */
export function buildCompactPromptFromMessages(messages: readonly InternalMessage[]): string {
  const { priorSummaryText, conversationMessages } = splitLeadingSummaryMessages(messages);
  const stripped = stripReasoningFromMessages(conversationMessages);
  const prepared = prepareMessagesForSummary(stripped);

  const priorSection = priorSummaryText ? formatPriorSummarySection(priorSummaryText) : '';
  const mergeHint = priorSummaryText ? SUMMARY_MERGE_PRIOR_HINT : '';
  const conversationHeader = priorSummaryText
    ? SUMMARY_CONVERSATION_HEADER
    : '【对话记录】\n';

  const usedChars =
    SUMMARY_PROMPT_PREFIX.length +
    mergeHint.length +
    priorSection.length +
    conversationHeader.length;
  const conversationBudget = Math.max(
    8000,
    ContextConfig.summarizeInputMaxChars - usedChars
  );
  const payload = buildSummaryPayload(prepared, { maxChars: conversationBudget });

  return SUMMARY_PROMPT_PREFIX + mergeHint + priorSection + conversationHeader + payload;
}

export async function compactHistory(
  messages: InternalMessage[],
  summarize: (serialized: string) => Promise<CompactSummarizeResult>
): Promise<InternalMessage[]> {
  const prepStarted = Date.now();
  const { priorSummaryText, conversationMessages } = splitLeadingSummaryMessages(messages);
  const serialized = buildCompactPromptFromMessages(messages);
  const payloadChars = serialized.length - SUMMARY_PROMPT_PREFIX.length;
  Logger.info(
    'CONTEXT',
    `摘要准备完成 messages=${messages.length} conv=${conversationMessages.length} ` +
      `hasPriorSummary=${!!priorSummaryText} payloadChars=${payloadChars} ` +
      `promptChars=${serialized.length} prepMs=${Date.now() - prepStarted}`
  );
  const { text: raw, finishReason } = await summarize(serialized);
  let summary = raw.trim();
  if (finishReason === 'length') {
    Logger.warn('CONTEXT', '摘要模型输出因 length 被截断，finish_reason=length');
    summary += '\n\n（摘要输出因模型长度上限被截断，请重试或调大 summarizeMaxTokens。）';
  }
  return [
    {
      role: 'user',
      content: `[上下文摘要]\n\n${summary}`,
      _source: 'summary',
      _timestamp: new Date().toISOString()
    }
  ];
}

export interface ApplyContextBeforeLlmOptions {
  requestId?: string;
  round?: number;
  summarizeFn?: (messages: InternalMessage[]) => Promise<InternalMessage[]>;
}

/**
 * 每轮 LLM 调用前：微压缩 → 打 budget 日志 → 超阈则摘要
 */
export async function applyContextBeforeLlm(
  messages: InternalMessage[],
  options: ApplyContextBeforeLlmOptions = {}
): Promise<boolean> {
  const snapshotForSummary = cloneMessages(messages);

  const trailing: InternalMessage[] = [];
  while (messages.length > 0 && messages[messages.length - 1]?.role === 'user') {
    trailing.unshift(messages.pop()!);
  }

  microCompact(messages);
  const forEstimate = [...messages, ...trailing];
  let estimated = estimateTokenCount(forEstimate);
  logContextBudget(forEstimate, estimated, { ...options, phase: 'before_llm' });

  if (
    !options.summarizeFn ||
    estimated < ContextConfig.compactThresholdTokens ||
    hasAppliedContextSummary(snapshotForSummary)
  ) {
    messages.push(...trailing);
    return false;
  }

  const compacted = await options.summarizeFn(snapshotForSummary);
  messages.length = 0;
  messages.push(...compacted, ...trailing);
  estimated = estimateTokenCount(messages);
  logContextBudget(messages, estimated, { ...options, phase: 'after_compact' });
  return true;
}

