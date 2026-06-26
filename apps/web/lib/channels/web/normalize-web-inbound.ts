import {
  resolveEnableAutoCompact,
  resolveMaxToolCallRounds,
  type InternalMessage,
} from '@meek/agent-core';
import { buildWebInboundEnvelope, buildWebSessionKey } from '@meek/message-bus';
import type { WebAgentMessageEnvelope } from '@meek/message-bus';

import { assembleContextMessages } from '@/lib/chat/chat-store-stub';

export interface WebInboundInput {
  body: Record<string, unknown>;
  requestId: string;
  abortSignal?: AbortSignal;
  userId?: string;
}

function resolveContextMessageCount(body: Record<string, unknown>): number | undefined {
  const contextOptions = body.contextOptions;
  if (typeof contextOptions !== 'object' || contextOptions === null) {
    return undefined;
  }
  const count = (contextOptions as Record<string, unknown>).messageHistoryCount;
  return typeof count === 'number' && count > 0 ? count : undefined;
}

function resolveMessages(body: Record<string, unknown>): InternalMessage[] {
  const messages = body.messages;
  const message = body.message;

  if (Array.isArray(messages) && messages.length > 0) {
    return messages as InternalMessage[];
  }

  if (typeof message === 'string' && message.length > 0) {
    return [{ role: 'user', content: message }];
  }

  throw new Error('缺少消息参数');
}

function buildChatOptionsFromBody(
  body: Record<string, unknown>
): WebAgentMessageEnvelope['payload']['chatOptions'] {
  const options: NonNullable<WebAgentMessageEnvelope['payload']['chatOptions']> = {};
  let hasOption = false;

  const assignBoolean = (key: 'enableTools' | 'enablePrompts' | 'skipMemory'): void => {
    const value = body[key];
    if (typeof value === 'boolean') {
      options[key] = value;
      hasOption = true;
    }
  };

  assignBoolean('enableTools');
  assignBoolean('enablePrompts');
  assignBoolean('skipMemory');

  if (typeof body.enableAutoCompact === 'boolean') {
    options.enableAutoCompact = resolveEnableAutoCompact(body.enableAutoCompact);
    hasOption = true;
  }

  if (typeof body.maxToolCallRounds === 'number') {
    options.maxToolCallRounds = resolveMaxToolCallRounds(body.maxToolCallRounds);
    hasOption = true;
  }
  if (typeof body.model === 'string') {
    options.model = body.model;
    hasOption = true;
  }
  if (typeof body.temperature === 'number') {
    options.temperature = body.temperature;
    hasOption = true;
  }
  if (typeof body.maxTokens === 'number') {
    options.maxTokens = body.maxTokens;
    hasOption = true;
  }
  if (typeof body.compactModel === 'string') {
    options.compactModel = body.compactModel;
    hasOption = true;
  }
  if (Array.isArray(body.mcpServerIds)) {
    options.mcpServerIds = body.mcpServerIds.filter((id): id is string => typeof id === 'string');
    hasOption = true;
  }
  if (Array.isArray(body.enabledToolNames)) {
    options.enabledToolNames = body.enabledToolNames.filter(
      (name): name is string => typeof name === 'string'
    );
    hasOption = true;
  }
  if (Array.isArray(body.enabledSystemToolNames)) {
    options.enabledSystemToolNames = body.enabledSystemToolNames.filter(
      (name): name is string => typeof name === 'string'
    );
    hasOption = true;
  }
  if (
    body.permissionMode === 'open' ||
    body.permissionMode === 'interactive' ||
    body.permissionMode === 'locked'
  ) {
    options.permissionMode = body.permissionMode;
    hasOption = true;
  }

  return hasOption ? options : undefined;
}

export async function normalizeWebInbound(
  input: WebInboundInput
): Promise<WebAgentMessageEnvelope> {
  const { body, requestId, abortSignal, userId } = input;
  const vendor = typeof body.vendor === 'string' ? body.vendor : undefined;
  const webChatSessionId =
    typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!webChatSessionId) {
    throw new Error('缺少 sessionId（Web 聊天会话标识）');
  }

  let messages: InternalMessage[];
  if (userId) {
    const newMessages = resolveMessages(body);
    if (newMessages.some((message) => message.role !== 'user')) {
      throw new Error('已登录会话仅可上行新的 user 消息，历史由服务端组装');
    }
    const taggedNew = newMessages.map<InternalMessage>((message) => ({
      ...message,
      _source: 'user',
    }));
    const context = await assembleContextMessages(userId, webChatSessionId, {
      messageHistoryCount: resolveContextMessageCount(body),
    });
    messages = [...context, ...taggedNew];
  } else {
    messages = resolveMessages(body);
  }

  const chatOptions = buildChatOptionsFromBody(body);

  return buildWebInboundEnvelope({
    requestId,
    sessionKey: buildWebSessionKey(requestId),
    webChatSessionId,
    messages,
    chatOptions,
    idempotencyKey: requestId,
    ...(vendor !== undefined ? { vendor } : {}),
    ...(userId !== undefined ? { userId } : {}),
    ...(abortSignal !== undefined ? { abortSignal } : {}),
  });
}
