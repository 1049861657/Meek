import type { AgentOutboundEnvelope } from '@meek/message-bus';
import { publishOutboundEvent } from '@meek/message-bus';

import { getChannelAdapter } from '../channels/registry.js';

/** 出站路由：web → Redis Pub/Sub；IM → 进程内 ChannelAdapter */
export async function routeOutboundEnvelope(envelope: AgentOutboundEnvelope): Promise<void> {
  if (envelope.channel === 'web') {
    await publishOutboundEvent(envelope.requestId, envelope);
    return;
  }

  const adapter = getChannelAdapter(envelope.channel);
  if (!adapter) {
    console.warn(`[BUS] 出站路由失败：未注册 channel=${envelope.channel}`);
    return;
  }
  adapter.sendOutbound(envelope);
}
