/**
 * 消息历史 ↔ OpenAI API messages 转换 — 对齐 message-history-builder.js
 */

import type { HistoryEntry, StoredToolCall } from './storage-contract';

export interface ApiMessage {
  role: string;
  content?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
  reasoning_content?: string;
}

/** harness_reminder 仅用于 Harness 当轮上下文，不进入持久化 / API 回放 */
export function isEphemeralHarnessMessage(entry: HistoryEntry | null | undefined): boolean {
  if (!entry || entry.role !== 'user' || typeof entry.content !== 'string') {
    return false;
  }
  if (!entry.content.startsWith('{')) {
    return false;
  }
  try {
    const parsed = JSON.parse(entry.content) as { type?: string };
    return parsed.type === 'harness_reminder';
  } catch {
    return false;
  }
}

function entryToApiMessages(entry: HistoryEntry): ApiMessage[] {
  if (!entry?.role) {
    return [];
  }

  if (entry.role === 'user') {
    if (isEphemeralHarnessMessage(entry)) {
      return [];
    }
    return [{ role: 'user', content: entry.content ?? '' }];
  }

  if (entry.role === 'tool') {
    return [
      {
        role: 'tool',
        content: stringifyToolContent(entry.content),
        tool_call_id: entry.tool_call_id,
      },
    ];
  }

  if (entry.role === 'assistant') {
    const apiMessages: ApiMessage[] = [];
    const assistant: ApiMessage = {
      role: 'assistant',
      content: entry.content ?? '',
    };

    const reasoning = entry.reasoning_content ?? entry.reasoning;
    if (reasoning) {
      assistant.reasoning_content = reasoning;
    }

    const toolCalls = entry.tool_calls ?? buildToolCallsFromStored(entry.toolCalls);
    if (toolCalls.length > 0) {
      assistant.tool_calls = toolCalls;
    }

    apiMessages.push(assistant);

    if (!entry._toolResultsExpanded && entry.toolCalls && entry.toolCalls.length > 0) {
      for (const tc of entry.toolCalls) {
        if (tc.result === null || tc.result === undefined) {
          continue;
        }
        apiMessages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: stringifyToolContent(tc.result),
        });
      }
    }

    return apiMessages;
  }

  return [];
}

export function buildApiMessagesFromHistory(history: HistoryEntry[], count: number): ApiMessage[] {
  const recent = history.slice(-count);
  const apiMessages: ApiMessage[] = [];

  for (const entry of recent) {
    if (isEphemeralHarnessMessage(entry)) {
      continue;
    }
    if (entry.role === 'tool') {
      apiMessages.push({
        role: 'tool',
        content: stringifyToolContent(entry.content),
        tool_call_id: entry.tool_call_id,
      });
      continue;
    }
    apiMessages.push(...entryToApiMessages(entry));
  }

  return apiMessages;
}

export function buildToolCallsFromStored(toolCalls: StoredToolCall[] | undefined): unknown[] {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
    return [];
  }
  return toolCalls.map((tc) => ({
    id: tc.id,
    type: 'function',
    function: {
      name: tc.name,
      arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args ?? {}),
    },
  }));
}

export function stringifyToolContent(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value !== null && (value as { _truncated?: boolean })._truncated === true) {
    return JSON.stringify(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** IDB 原始记录 → messageHistory 条目 */
export function mapIdbRecordToHistoryEntry(
  msg: HistoryEntry & { id?: number | string; timestamp?: number },
): HistoryEntry {
  return {
    role: msg.role,
    content: msg.content,
    turnId: msg.turnId,
    ...(msg.id !== undefined && msg.id !== null ? { id: String(msg.id) } : {}),
    ...(typeof msg.timestamp === 'number' ? { timestamp: msg.timestamp } : {}),
    reasoning: msg.reasoning ?? msg.reasoning_content,
    reasoning_content: msg.reasoning_content ?? msg.reasoning,
    tool_calls: msg.tool_calls,
    tool_call_id: msg.tool_call_id,
    toolCalls: msg.toolCalls,
    _toolResultsExpanded: msg._toolResultsExpanded,
  };
}

export function filterPersistableHistoryEntries(messages: HistoryEntry[]): HistoryEntry[] {
  return messages
    .filter((msg) => !isEphemeralHarnessMessage(msg))
    .filter(
      (msg) =>
        Boolean(msg.role) &&
        ((msg.content != null && msg.content !== '') ||
          msg.role === 'tool' ||
          (msg.role === 'assistant' &&
            Boolean(msg.tool_calls?.length || msg.toolCalls?.length)))
    );
}
