import type { ChannelId, ChatAgentOptions, MemoryIdentityScope, PermissionMode } from '@meek/shared';

/** @deprecated 历史 seed 残留；Resolver 已改为按渠道默认方案解析 */
export const CONFIG_PROFILE_GLOBAL_DEFAULT = 'global-default';
export const CONFIG_PROFILE_WEB_DEFAULT = 'web-default';
export const CONFIG_PROFILE_FEISHU_DEFAULT = 'feishu-default';
export const CONFIG_PROFILE_DINGTALK_DEFAULT = 'dingtalk-default';

export const EDITABLE_IM_CHANNEL_PROFILE_IDS = [
  CONFIG_PROFILE_DINGTALK_DEFAULT,
  CONFIG_PROFILE_FEISHU_DEFAULT,
] as const;

export type EditableImChannelProfileId = (typeof EDITABLE_IM_CHANNEL_PROFILE_IDS)[number];

export type ChannelDefaultProfileId =
  | EditableImChannelProfileId
  | typeof CONFIG_PROFILE_WEB_DEFAULT;

export const CHANNEL_DEFAULT_PROFILE_BY_CHANNEL: Record<ChannelId, ChannelDefaultProfileId> = {
  dingtalk: CONFIG_PROFILE_DINGTALK_DEFAULT,
  feishu: CONFIG_PROFILE_FEISHU_DEFAULT,
  web: CONFIG_PROFILE_WEB_DEFAULT,
};

export const ROUTE_MATCH_ALL = '*';

export const SETTING_CHANNEL_BINDINGS = 'channelBindings';

export const SETTING_SEED_FOLLOW_USER_ID = 'seedFollowUserId';

export interface AgentProfileRecord {
  profileId: string;
  displayName: string;
  vendor: string | null;
  defaultModel: string;
  temperature: number | null;
  maxTokens: number | null;
  enableTools: boolean;
  enablePrompts: boolean;
  maxToolCallRounds: number;
  permissionMode: PermissionMode;
  enableAutoCompact: boolean | null;
  compactModel: string | null;
  mcpServerIds: string[];
  toolPrompt: string | null;
  tenantId: string | null;
  updatedAt: Date;
}

export interface RouteRuleRecord {
  id: string;
  boundUserId: string | null;
  channel: ChannelId;
  matchKey: string;
  profileId: string;
  priority: number;
  enabled: boolean;
  tenantId: string | null;
}

export interface ProfileResolveContext {
  channel: ChannelId;
  sessionKey: string;
  documentSessionId?: string;
  routeMatchKey: string;
  envelopeChatOptions?: ChatAgentOptions;
  vendorFromChannelMeta?: string;
  userId?: string;
  chatSessionId?: string;
  memoryScope?: MemoryIdentityScope;
}

export interface ConfigPlaneSeedResult {
  seededEmpty: boolean;
  createdProfiles: number;
  createdRoutes: number;
}
