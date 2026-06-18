import {
  isHindsightMemoryConfigured,
  MemoryConfig,
  resolveSkipMemory,
} from './config/feature-config.js';
import type { InternalMessage } from './types.js';
import type { MemoryIdentityScope } from '@meek/shared';
import { resolveHindsightBankId } from './ports/memory-port.js';

export interface MemoryPipelineContext {
  bankId: string;
  query: string;
  skipMemory: boolean;
  documentSessionId?: string;
}

export function resolveMemoryBankId(scope?: MemoryIdentityScope): string | undefined {
  if (!scope) {
    return undefined;
  }
  switch (scope.channel) {
    case 'web':
      return scope.userId
        ? resolveHindsightBankId('web', `web:${scope.userId}`)
        : undefined;
    case 'feishu':
      return resolveHindsightBankId('feishu', `feishu:${scope.chatId}`);
    case 'dingtalk':
      return resolveHindsightBankId(
        'dingtalk',
        scope.robotCode
          ? `dingtalk:${scope.conversationId}:${scope.robotCode}`
          : `dingtalk:${scope.conversationId}`
      );
  }
}

export interface RetainConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface RetainPayload {
  content: string;
  conversationStartedAt?: string;
}

function messageText(content: InternalMessage['content']): string {
  if (typeof content === 'string') {
    return content.trim();
  }
  return '';
}

function isRetainEligibleMessage(message: InternalMessage): boolean {
  if (message.role !== 'user' && message.role !== 'assistant') {
    return false;
  }
  if (message._source === 'reminder' || message._source === 'hook') {
    return false;
  }
  return messageText(message.content).length > 0;
}

function toRetainTurn(message: InternalMessage): RetainConversationTurn {
  const turn: RetainConversationTurn = {
    role: message.role as 'user' | 'assistant',
    content: messageText(message.content).slice(0, MemoryConfig.perMessageRetainMaxChars),
  };
  const timestamp = message._timestamp?.trim();
  if (timestamp) {
    turn.timestamp = timestamp;
  }
  return turn;
}

function buildRetainJson(
  messages: InternalMessage[],
  options?: { startIndex?: number }
): RetainPayload {
  const startIndex = options?.startIndex ?? 0;
  const turns: RetainConversationTurn[] = [];
  let serializedLength = 2;

  for (let i = startIndex; i < messages.length; i += 1) {
    const message = messages[i];
    if (!message || !isRetainEligibleMessage(message)) {
      continue;
    }

    const turn = toRetainTurn(message);
    const turnJson = JSON.stringify(turn);
    const addedLength = turns.length === 0 ? turnJson.length : turnJson.length + 1;
    if (serializedLength + addedLength > MemoryConfig.sessionRetainMaxChars) {
      break;
    }

    turns.push(turn);
    serializedLength += addedLength;
  }

  return {
    content: JSON.stringify(turns),
    conversationStartedAt: turns[0]?.timestamp,
  };
}

export function extractRecallQuery(messages: InternalMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const text = messageText(messages[i]?.content);
    if (messages[i]?.role === 'user' && text.length > 0) {
      return text.slice(0, MemoryConfig.recallQueryMaxChars);
    }
  }
  return 'user preferences and project conventions';
}

export function buildSessionRetainSummary(messages: InternalMessage[]): RetainPayload {
  return buildRetainJson(messages);
}

export function buildTurnRetainDelta(messages: InternalMessage[]): RetainPayload {
  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== 'user' || !isRetainEligibleMessage(message)) {
      continue;
    }
    lastUserIndex = i;
    break;
  }
  if (lastUserIndex < 0) {
    return { content: '[]' };
  }

  return buildRetainJson(messages, { startIndex: lastUserIndex });
}

export function buildRetainContent(
  messages: InternalMessage[],
  documentSessionId?: string
): RetainPayload {
  if (documentSessionId?.trim()) {
    const delta = buildTurnRetainDelta(messages);
    if (delta.content !== '[]') {
      return delta;
    }
  }
  return buildSessionRetainSummary(messages);
}

export function resolveMemoryPipelineContext(
  messages: InternalMessage[],
  options: {
    skipMemory?: boolean;
    documentSessionId?: string;
    identityScope?: MemoryIdentityScope;
  }
): MemoryPipelineContext | undefined {
  const skipMemory = resolveSkipMemory(options.skipMemory);
  if (skipMemory || !isHindsightMemoryConfigured()) {
    return undefined;
  }

  const bankId = resolveMemoryBankId(options.identityScope);
  if (!bankId) {
    return undefined;
  }

  const documentSessionId = options.documentSessionId?.trim();

  return {
    bankId,
    query: extractRecallQuery(messages),
    skipMemory: false,
    ...(documentSessionId ? { documentSessionId } : {}),
  };
}
