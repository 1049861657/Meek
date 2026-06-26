import { registerChannelAdapter } from './registry.js';
import { getFeishuChannelAdapter } from './feishu/feishu-channel.adapter.js';
import { getFeishuLinkStatus, startFeishuEventListener } from './feishu/feishu-event-listener.js';

export type ImChannelLinkStatus = 'connected' | 'connecting' | 'disconnected' | 'skipped';

export interface ImChannelStatusMap {
  feishu: ImChannelLinkStatus;
  dingtalk: ImChannelLinkStatus;
}

/** 注册 IM Adapter 并启动长连接（Web 出站仍在 BFF，不经此注册表） */
export function startChannels(): void {
  registerChannelAdapter(getFeishuChannelAdapter());
  startFeishuEventListener();
}

export function getImChannelLinkStatusMap(): ImChannelStatusMap {
  return {
    feishu: getFeishuLinkStatus(),
    dingtalk: 'skipped',
  };
}
