/**
 * 组装送入 API 的上下文消息与 authed 模式取数字段 — 对齐 context-messages.js
 */

import { buildApiMessagesFromHistory, type ApiMessage } from './message-history-builder';
import type { CompactedBaselineStorage, HistoryEntry } from './storage-contract';

export interface ChatContextState {
  messageHistory: HistoryEntry[];
  messageHistoryCount: number;
  enableMessageHistory: boolean;
  compactedBaseline: CompactedBaselineStorage | null;
  apiContextOverride: ApiMessage[] | null;
  sessionId: string;
}

export interface AuthedContextDeps {
  isAuthed: () => boolean;
}

export function buildApiContextMessages(
  state: ChatContextState,
  newUserContent: string | null
): ApiMessage[] {
  let messages: ApiMessage[] = [];

  if (state.apiContextOverride?.length) {
    messages = state.apiContextOverride.map((m) => ({ ...m }));
  } else if (state.compactedBaseline) {
    const { summaryContent, historyStartIndex } = state.compactedBaseline;
    const tail = state.messageHistory.slice(historyStartIndex);
    const tailApi = buildApiMessagesFromHistory(
      tail,
      Math.max(tail.length, state.messageHistoryCount || tail.length)
    );
    messages = [{ role: 'user', content: summaryContent }, ...tailApi];
  } else if (state.enableMessageHistory && state.messageHistory.length > 0) {
    messages = buildApiMessagesFromHistory(
      state.messageHistory,
      state.messageHistoryCount
    );
  }

  if (newUserContent) {
    messages.push({ role: 'user', content: newUserContent });
  }
  return messages;
}

/** authed 模式下 context-preview / compact 的服务端取数字段 */
export function authedContextFields(
  state: ChatContextState,
  deps: AuthedContextDeps
): Record<string, unknown> {
  if (!deps.isAuthed()) {
    return {};
  }
  return {
    sessionId: state.sessionId,
    contextOptions: { messageHistoryCount: state.messageHistoryCount },
  };
}

export function buildOutgoingMessages(
  state: ChatContextState,
  newUserContent: string
): ApiMessage[] {
  return buildApiContextMessages(state, newUserContent);
}

export function buildBaseContextMessages(state: ChatContextState): ApiMessage[] {
  return buildApiContextMessages(state, null);
}
