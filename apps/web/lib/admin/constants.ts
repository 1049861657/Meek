import type { ChannelKey } from './types';

export const IM_CHANNELS: Array<{
  key: ChannelKey;
  label: string;
  badge: string;
  iconClass: string;
}> = [
  { key: 'dingtalk', label: '钉钉', badge: '钉', iconClass: 'channel-item__icon--ding' },
  { key: 'feishu', label: '飞书', badge: '飞', iconClass: 'channel-item__icon--feishu' },
];

export const CONFIG_RELOAD_DEBOUNCE_MS = 300;
export const CHANNEL_STATUS_POLL_INTERVAL_MS = 2000;
export const CHANNEL_STATUS_POLL_DURATION_MS = 30000;

export const PERM_OPTIONS = [
  { value: 'open' as const, label: '自动', hint: '除黑名单外自动执行，对话中不询问' },
  { value: 'locked' as const, label: '只读', hint: '仅只读工具可执行，其余一律拒绝' },
];

export const MCP_ICON_TONES = ['emerald', 'sky', 'teal', 'violet', 'amber', 'rose'] as const;

export const TOOL_PROMPT_MAX_LENGTH = 1000;
export const MAX_TOOL_CALL_ROUNDS_MIN = 1;
export const MAX_TOOL_CALL_ROUNDS_MAX = 100;
export const MCP_FLASH_MS = 1400;
