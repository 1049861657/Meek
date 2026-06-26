import type { InternalMessage } from '@meek/agent-core';

import type {
  AgentInboundPayload,
  AgentTrace,
  ChatOptions,
  DingtalkAgentMessageEnvelope,
  DingtalkChannelMeta,
  FeishuAgentMessageEnvelope,
  WebAgentMessageEnvelope,
} from './channel.types.js';

interface InboundEnvelopeCore {
  requestId: string;
  sessionKey: string;
  messages: InternalMessage[];
  chatOptions?: ChatOptions;
  idempotencyKey: string;
}

function buildTrace(requestId: string, idempotencyKey: string): AgentTrace {
  return {
    traceId: requestId,
    idempotencyKey,
  };
}

function buildPayload(
  messages: InternalMessage[],
  chatOptions?: ChatOptions
): AgentInboundPayload {
  return {
    messages,
    ...(chatOptions !== undefined ? { chatOptions } : {}),
  };
}

export function buildWebInboundEnvelope(
  params: InboundEnvelopeCore & {
    webChatSessionId: string;
    vendor?: string;
    userId?: string;
    abortSignal?: AbortSignal;
  }
): WebAgentMessageEnvelope {
  const { requestId, sessionKey, messages, chatOptions, idempotencyKey } = params;
  return {
    id: requestId,
    source: 'web:api',
    type: 'agent.message.inbound',
    time: new Date().toISOString(),
    channel: 'web',
    sessionKey,
    channelMeta: {
      requestId,
      webChatSessionId: params.webChatSessionId,
      ...(params.vendor !== undefined ? { vendor: params.vendor } : {}),
      ...(params.userId !== undefined ? { userId: params.userId } : {}),
      ...(params.abortSignal !== undefined ? { abortSignal: params.abortSignal } : {}),
    },
    payload: buildPayload(messages, chatOptions),
    trace: buildTrace(requestId, idempotencyKey),
  };
}

export function buildFeishuInboundEnvelope(
  params: InboundEnvelopeCore & {
    messageId: string;
    chatId: string;
    vendor?: string;
    abortSignal?: AbortSignal;
  }
): FeishuAgentMessageEnvelope {
  const { requestId, sessionKey, messages, chatOptions, idempotencyKey } = params;
  return {
    id: requestId,
    source: 'feishu:im',
    type: 'agent.message.inbound',
    time: new Date().toISOString(),
    channel: 'feishu',
    sessionKey,
    channelMeta: {
      requestId,
      messageId: params.messageId,
      chatId: params.chatId,
      ...(params.vendor !== undefined ? { vendor: params.vendor } : {}),
      ...(params.abortSignal !== undefined ? { abortSignal: params.abortSignal } : {}),
    },
    payload: buildPayload(messages, chatOptions),
    trace: buildTrace(requestId, idempotencyKey),
  };
}

export function buildDingtalkInboundEnvelope(
  params: InboundEnvelopeCore & {
    channelMeta: Omit<DingtalkChannelMeta, 'requestId' | 'abortSignal'>;
    abortSignal?: AbortSignal;
  }
): DingtalkAgentMessageEnvelope {
  const { requestId, sessionKey, messages, chatOptions, idempotencyKey } = params;
  return {
    id: requestId,
    source: 'dingtalk:im',
    type: 'agent.message.inbound',
    time: new Date().toISOString(),
    channel: 'dingtalk',
    sessionKey,
    channelMeta: {
      requestId,
      ...params.channelMeta,
      ...(params.abortSignal !== undefined ? { abortSignal: params.abortSignal } : {}),
    },
    payload: buildPayload(messages, chatOptions),
    trace: buildTrace(requestId, idempotencyKey),
  };
}
