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
  if (!isWebInboundEnvelope(envelope)) {
    throw new Error(`resolvePermissionSessionKey: 仅支持 Web 渠道，收到 ${envelope.channel}`);
  }
  const chatSessionId = envelope.channelMeta.webChatSessionId.trim();
  if (!chatSessionId) {
    throw new Error('Web 入站缺少 channelMeta.webChatSessionId（body.sessionId）');
  }
  return buildWebChatPermissionSessionKey(chatSessionId);
}
