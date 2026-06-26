import type { ChannelId } from '@meek/shared';

import type { ChannelAdapter } from './types.js';

const adapters = new Map<ChannelId, ChannelAdapter>();

export function registerChannelAdapter(adapter: ChannelAdapter): void {
  adapters.set(adapter.channel, adapter);
}

export function getChannelAdapter(channel: ChannelId): ChannelAdapter | undefined {
  return adapters.get(channel);
}
