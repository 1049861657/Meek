import type { AgentMessageEnvelopeSerialized } from './channel.types.js';

/** 入队/出队日志公共字段 */
export function formatInboundLogFields(envelope: AgentMessageEnvelopeSerialized): string {
  return [
    `traceId=${envelope.trace.traceId}`,
    `sessionKey=${envelope.sessionKey}`,
    `channel=${envelope.channel}`,
    `requestId=${envelope.channelMeta.requestId}`,
  ].join(' ');
}
