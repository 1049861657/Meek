/**
 * 会话消息回放条目（纯数据，无 DOM）— 对齐 session-conversation.js
 */

import type { HistoryEntry, StoredToolCall } from './storage-contract';

export interface ConversationReplayItem {
  type: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  toolCalls?: StoredToolCall[];
}

/**
 * 将 messageHistory / IDB 条目转为 UI 回放序列（跳过独立 tool 行，assistant 已含 toolCalls）
 */
export function buildConversationReplay(messages: HistoryEntry[]): ConversationReplayItem[] {
  const items: ConversationReplayItem[] = [];
  let previousUserMessage: HistoryEntry | null = null;

  for (const message of messages) {
    if (message.role === 'user') {
      previousUserMessage = message;
      items.push({
        type: 'user',
        content: message.content ?? '',
      });
    } else if (message.role === 'tool') {
      continue;
    } else if (message.role === 'assistant' && previousUserMessage) {
      items.push({
        type: 'assistant',
        content: message.content ?? '',
        reasoning: message.reasoning_content ?? message.reasoning,
        toolCalls: message.toolCalls?.length ? message.toolCalls : undefined,
      });
    }
  }

  return items;
}
