/**
 * 聊天消息统一视图模型 — HistoryEntry / IDB / 服务端 → UI 单一路径
 */

import type { AssistantMessage, ChatMessage, ToolCallState } from './chat-ui-types';
import {
  formatStoredToolArgs,
  formatStoredToolResult,
  mergeHistoricalTodoCalls,
  normalizePlanningItems,
  resolveToolSource,
} from './tool-renderers';
import type { HistoryEntry, StoredToolCall } from './storage-contract';

export interface ChatMessageRecord {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  reasoning?: string;
  toolCalls?: StoredToolCall[];
  planningItems?: AssistantMessage['planningItems'];
}

type HistoryEntrySource = HistoryEntry & { id?: string | number };

function resolveStableMessageId(entry: HistoryEntrySource): string | null {
  if (entry.id !== undefined && entry.id !== null && String(entry.id).length > 0) {
    return String(entry.id);
  }
  if (typeof entry.timestamp === 'number') {
    return `${entry.role}-${entry.timestamp}`;
  }
  return null;
}

function storedToolToState(tc: StoredToolCall): ToolCallState {
  const source = resolveToolSource({ name: tc.name, source: tc.source });
  const hasResult = tc.result !== null && tc.result !== undefined;
  return {
    id: tc.id,
    name: tc.name,
    source,
    args: formatStoredToolArgs(tc.args),
    argsComplete: true,
    status: tc.isError ? 'error' : hasResult ? 'success' : 'running',
    result: hasResult ? formatStoredToolResult(tc.result, tc.isError) : undefined,
    resultError: tc.isError,
    executionTime: tc.executionTime,
    planningItems: tc.name === 'todo' ? normalizePlanningItems(tc.planningItems) : undefined,
    revision: tc.revision,
    progressSteps: tc.progressSteps?.map((step) => ({
      progress: step.isDone ? 1 : 0,
      total: 1,
      message: step.message,
      elapsedMs: step.elapsed_ms,
    })),
  };
}

export function historyEntryToRecord(entry: HistoryEntrySource): ChatMessageRecord | null {
  if (entry.role === 'tool') {
    return null;
  }

  const id = resolveStableMessageId(entry);
  if (!id) {
    return null;
  }

  if (entry.role === 'user') {
    return {
      id,
      role: 'user',
      content: entry.content ?? '',
      ...(typeof entry.timestamp === 'number' ? { timestamp: entry.timestamp } : {}),
    };
  }

  if (entry.role === 'assistant') {
    return {
      id,
      role: 'assistant',
      content: entry.content ?? '',
      reasoning: entry.reasoning_content ?? entry.reasoning,
      toolCalls: entry.toolCalls,
      planningItems: entry.toolCalls?.find((tc) => tc.name === 'todo')?.planningItems,
      ...(typeof entry.timestamp === 'number' ? { timestamp: entry.timestamp } : {}),
    };
  }

  return null;
}

export function historyEntriesToRecords(entries: HistoryEntrySource[]): ChatMessageRecord[] {
  const records: ChatMessageRecord[] = [];
  for (const entry of entries) {
    const record = historyEntryToRecord(entry);
    if (record) {
      records.push(record);
    }
  }
  return records;
}

export function recordsToChatMessages(records: ChatMessageRecord[]): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (const record of records) {
    if (record.role === 'user') {
      messages.push({
        id: record.id,
        role: 'user',
        content: record.content,
        ...(typeof record.timestamp === 'number' ? { timestamp: record.timestamp } : {}),
      });
      continue;
    }

    const toolCalls = record.toolCalls?.length
      ? mergeHistoricalTodoCalls(record.toolCalls).map(storedToolToState)
      : [];
    messages.push({
      id: record.id,
      role: 'assistant',
      content: record.content,
      reasoning: record.reasoning,
      toolCalls,
      isStreaming: false,
      planningItems: record.planningItems,
      ...(typeof record.timestamp === 'number' ? { timestamp: record.timestamp } : {}),
    });
  }

  return messages;
}

export function historyEntriesToChatMessages(entries: HistoryEntrySource[]): ChatMessage[] {
  return recordsToChatMessages(historyEntriesToRecords(entries));
}
