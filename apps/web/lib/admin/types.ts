export type AdminViewMode = 'loading' | 'guest' | 'forbidden' | 'ready';

export type AdminTab = 'users' | 'channels';

export type ChannelKey = 'dingtalk' | 'feishu';

export type ChannelLinkStatus = 'connected' | 'connecting' | 'disconnected' | 'skipped';

export type PermissionMode = 'open' | 'locked';

export interface AdminUser {
  id: string;
  username: string | null;
  email: string | null;
  role: string;
  createdAt: string;
}

export interface SeedFollow {
  userId: string | null;
  username: string | null;
}

export interface RouteRule {
  id: string;
  channel: string;
  matchKey: string;
  boundUserId?: string | null;
}

export interface ProviderOption {
  name: string;
  defaultModel: string;
  models: Array<{ value: string; label: string }>;
}

export interface McpServerOption {
  id: string;
  name: string;
  poolEnabled: boolean;
}

export interface ChannelProfile {
  vendor?: string | null;
  defaultModel?: string;
  temperature?: number;
  maxTokens?: number;
  enableTools?: boolean;
  enablePrompts?: boolean;
  permissionMode?: PermissionMode;
  enableAutoCompact?: boolean;
  compactModel?: string | null;
  mcpServerIds?: string[];
  maxToolCallRounds?: number;
  toolPrompt?: string;
}

export interface ChannelConfigState {
  profile: ChannelProfile;
  resources: {
    providers: ProviderOption[];
    mcpServers: McpServerOption[];
  };
  accountDefaults?: ChannelProfile;
  accountToolPrompt?: string;
}

export interface ChannelConfigFormPayload {
  vendor: string | null;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  enableTools: boolean;
  enablePrompts: boolean;
  permissionMode: PermissionMode;
  enableAutoCompact: boolean;
  compactModel: string | null;
  mcpServerIds: string[];
  maxToolCallRounds: number;
  toolPrompt?: string;
}

export interface ChannelConfigSaveResult {
  profile?: ChannelProfile;
  skippedMcpServers?: Array<{ id: string; name: string }>;
}

export interface ChannelStatusMap {
  dingtalk: ChannelLinkStatus;
  feishu: ChannelLinkStatus;
}

export interface ChannelConfigCacheEntry {
  boundUserId: string | null;
  state: ChannelConfigState;
  /** 绑定切换后首次填表用账号默认，否则用已保存 profile */
  formInit?: 'profile' | 'accountDefaults';
}
