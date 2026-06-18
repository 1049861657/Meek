/** T1 支持的渠道标识 */
export type ChannelId = 'web' | 'feishu' | 'dingtalk';

/** 工具执行方式：open 自动 · interactive 确认 · locked 只读 */
export type PermissionMode = 'open' | 'interactive' | 'locked';

/**
 * 外接记忆按身份分段的作用域（T4-05）：
 * - Web authed：`userId`（guest 无 userId → 关闭记忆）；
 * - IM：会话级标识（飞书 chatId、钉钉 conversationId(+robotCode)），不混入 Web 账号。
 */
export type MemoryIdentityScope =
  | { channel: 'web'; userId?: string }
  | { channel: 'feishu'; chatId: string }
  | { channel: 'dingtalk'; conversationId: string; robotCode?: string };

/** 聊天选项（全部可选，Worker 侧 pickDefined 透传） */
export interface ChatAgentOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  enableTools?: boolean;
  enablePrompts?: boolean;
  maxToolCallRounds?: number;
  enableAutoCompact?: boolean;
  compactModel?: string;
  /** Web body override：当次启用的 MCP 服务器 ID 列表 */
  mcpServerIds?: string[];
  /** Web body override：当次启用的 MCP 工具 codeName 白名单 */
  enabledToolNames?: string[];
  /** Web body override：当次启用的 System 工具 codeName */
  enabledSystemToolNames?: string[];
  permissionMode?: PermissionMode;
  /** true 时跳过 Hindsight recall 与 retain */
  skipMemory?: boolean;
}

/**
 * Resolver 输出：Inbound Worker / AiProvider 唯一能力入参。
 * 字段在 `ChatAgentOptions` 基础上补全必填，并增加 Profile 元数据。
 */
export interface ResolvedProfile extends Required<
  Pick<
    ChatAgentOptions,
    | 'enableTools'
    | 'enablePrompts'
    | 'maxToolCallRounds'
    | 'enableAutoCompact'
  >
> {
  profileId: string;
  vendor?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  compactModel?: string;
  mcpServerIds: string[];
  enabledToolNames?: string[];
  enabledSystemToolNames?: string[];
  toolPrompt: string;
  permissionMode: PermissionMode;
  skipMemory?: boolean;
  documentSessionId?: string;
  userId?: string;
  configUserId?: string | null;
  chatSessionId?: string;
  memoryScope?: MemoryIdentityScope;
}
