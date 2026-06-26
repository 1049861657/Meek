import type { AgentOutboundEnvelope } from '@meek/message-bus';
import type { ChannelId } from '@meek/shared';

/** 渠道适配器：出站写回（Web 经 Redis；IM 进程内 reply） */
export interface ChannelAdapter {
  readonly channel: ChannelId;
  sendOutbound(envelope: AgentOutboundEnvelope): void;
  registerSink(_requestId: string, _sink: unknown): void;
  unregisterSink(_requestId: string): void;
}
