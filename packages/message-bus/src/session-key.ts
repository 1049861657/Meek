import type { AgentMessageEnvelopeSerialized } from './channel.types.js';
import { isWebInboundEnvelope } from './channel.types.js';

export function buildWebSessionKey(requestId: string): string {
  return `web:${requestId}`;
}

export function buildWebChatPermissionSessionKey(chatSessionId: string): string {
  return `web-chat:${chatSessionId}`;
}

export function resolvePermissionSessionKey(
  envelope: AgentMessageEnvelopeSerialized
): string {
  if (isWebInboundEnvelope(envelope)) {
    const chatSessionId = envelope.channelMeta.webChatSessionId?.trim() ?? '';
    if (!chatSessionId) {
      throw new Error('Web 入站缺少 channelMeta.webChatSessionId（body.sessionId）');
    }
    return buildWebChatPermissionSessionKey(chatSessionId);
  }
  return envelope.sessionKey;
}

export function buildFeishuSessionKey(chatId: string): string {
  return `feishu:${chatId}`;
}

export function buildDingtalkSessionKey(conversationId: string): string {
  return `dingtalk:${conversationId}`;
}
