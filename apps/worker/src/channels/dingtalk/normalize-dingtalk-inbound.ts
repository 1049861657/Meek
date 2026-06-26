import type { DingtalkAgentMessageEnvelope } from '@meek/message-bus';
import {
  buildDingtalkInboundEnvelope,
  buildDingtalkSessionKey,
  generateRequestId,
} from '@meek/message-bus';

import type {
  DingtalkBotMessageDownstream,
  DingtalkBotTextMessage,
} from './dingtalk-event.types.js';

export class DingtalkInboundSkipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DingtalkInboundSkipError';
  }
}

const GROUP_CONVERSATION_TYPE = '2';
const SINGLE_CONVERSATION_TYPE = '1';

function parseBotMessage(data: string): DingtalkBotTextMessage {
  const parsed = JSON.parse(data) as DingtalkBotTextMessage;
  if (parsed.msgtype !== 'text') {
    throw new DingtalkInboundSkipError(`暂不支持消息类型: ${parsed.msgtype}`);
  }
  return parsed;
}

function assertShouldProcess(message: DingtalkBotTextMessage): void {
  if (message.senderId === message.chatbotUserId) {
    throw new DingtalkInboundSkipError('跳过机器人消息');
  }

  if (message.conversationType === GROUP_CONVERSATION_TYPE && message.isInAtList !== true) {
    throw new DingtalkInboundSkipError('群聊未 @ 机器人');
  }

  if (
    message.conversationType !== GROUP_CONVERSATION_TYPE &&
    message.conversationType !== SINGLE_CONVERSATION_TYPE
  ) {
    throw new DingtalkInboundSkipError(`未知会话类型: ${message.conversationType}`);
  }
}

function resolveTextContent(message: DingtalkBotTextMessage): string {
  const content = message.text?.content?.trim() ?? '';
  if (content.length === 0) {
    throw new DingtalkInboundSkipError('消息文本为空');
  }
  return content;
}

function resolveMsgId(message: DingtalkBotTextMessage): string {
  const msgId = message.msgId?.trim();
  if (!msgId) {
    throw new Error('钉钉消息缺少 msgId');
  }
  return msgId;
}

function resolveSessionWebhook(message: DingtalkBotTextMessage): string {
  const sessionWebhook = message.sessionWebhook?.trim();
  if (!sessionWebhook) {
    throw new Error('钉钉消息缺少 sessionWebhook');
  }
  return sessionWebhook;
}

export function normalizeDingtalkInbound(
  downstream: DingtalkBotMessageDownstream
): DingtalkAgentMessageEnvelope {
  const message = parseBotMessage(downstream.data);
  assertShouldProcess(message);

  const msgId = resolveMsgId(message);
  const requestId = generateRequestId();
  const text = resolveTextContent(message);
  const sessionWebhook = resolveSessionWebhook(message);

  const channelMeta = {
    msgId,
    conversationId: message.conversationId,
    sessionWebhook,
    sessionWebhookExpiredTime: message.sessionWebhookExpiredTime ?? 0,
    ...(message.robotCode ? { robotCode: message.robotCode } : {}),
    ...(message.conversationType ? { conversationType: message.conversationType } : {}),
  };

  return buildDingtalkInboundEnvelope({
    requestId,
    sessionKey: buildDingtalkSessionKey(message.conversationId),
    channelMeta,
    messages: [{ role: 'user', content: text }],
    idempotencyKey: msgId,
  });
}
