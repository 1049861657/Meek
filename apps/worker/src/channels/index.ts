export type { FeishuReceiveMessageEvent } from './feishu/feishu-event.types.js';
export {
  FeishuInboundSkipError,
  normalizeFeishuInbound,
} from './feishu/normalize-feishu-inbound.js';
export { getFeishuChannelAdapter } from './feishu/feishu-channel.adapter.js';
export {
  getFeishuLinkStatus,
  startFeishuEventListener,
  type FeishuLinkStatus,
} from './feishu/feishu-event-listener.js';
export { getFeishuClient, initFeishuClient, resolveFeishuDomain } from './feishu/feishu-sdk.js';

export type {
  DingtalkBotMessageDownstream,
  DingtalkBotTextMessage,
} from './dingtalk/dingtalk-event.types.js';
export {
  DingtalkInboundSkipError,
  normalizeDingtalkInbound,
} from './dingtalk/normalize-dingtalk-inbound.js';

export {
  publishFeishuInboundFromEvent,
  publishDingtalkInboundFromDownstream,
} from './publish-im-inbound.js';

export { registerChannelAdapter, getChannelAdapter } from './registry.js';
export type { ChannelAdapter } from './types.js';
export {
  startChannels,
  getImChannelLinkStatusMap,
  type ImChannelLinkStatus,
  type ImChannelStatusMap,
} from './bootstrap.js';
