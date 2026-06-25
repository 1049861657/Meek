/**
 * messageHistory ↔ UI ChatMessage 映射
 */

import {
  createAssistantMessage,
  createUserMessage,
  type AssistantMessage,
  type ChatMessage,
  type ToolCallState,
} from './chat-ui-types';
import {
  formatStoredToolArgs,
  formatStoredToolResult,
  mergeHistoricalTodoCalls,
  resolveToolSource,
} from './tool-renderers';
import type { HistoryEntry, StoredToolCall } from './storage-contract';

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
    progressSteps: tc.progressSteps?.map((step) => ({
      progress: step.isDone ? 1 : 0,
      total: 1,
      message: step.message,
      elapsedMs: step.elapsed_ms,
    })),
  };
}

export function historyEntriesToChatMessages(entries: HistoryEntry[]): ChatMessage[] {
  const messages: ChatMessage[] = [];

  for (const entry of entries) {
    if (entry.role === 'user') {
      messages.push(createUserMessage(crypto.randomUUID(), entry.content ?? ''));
      continue;
    }
    if (entry.role === 'tool') {
      continue;
    }
    if (entry.role === 'assistant') {
      const toolCalls = entry.toolCalls?.length
        ? mergeHistoricalTodoCalls(entry.toolCalls).map(storedToolToState)
        : [];
      const assistant: AssistantMessage = {
        ...createAssistantMessage(crypto.randomUUID()),
        content: entry.content ?? '',
        reasoning: entry.reasoning_content ?? entry.reasoning,
        toolCalls,
        isStreaming: false,
        planningItems: entry.toolCalls?.find((tc) => tc.name === 'todo')?.planningItems,
      };
      messages.push(assistant);
    }
  }

  return messages;
}
