/** GET /api/config/features — tools 子配置 */
export interface ToolsFeatureConfig {
  enableMCPTools: boolean;
  enablePrompts: boolean;
  maxToolCallRounds: number;
  maxToolCallRoundsLimit: number;
}

export interface ChatFeatureConfig {
  defaultTemperature: number;
  defaultMaxTokens: number;
  defaultStreamMode: boolean;
}

export interface ContextFeatureConfig {
  charsPerTokenLatin: number;
  charsPerTokenCjk: number;
  persistThresholdChars: number;
  persistPreviewChars: number;
  agentOutputsDir: string;
  agentOutputsTtlDays: number;
  readPartialDefaultLines: number;
  microCompactKeepRecent: number;
  enableAutoCompact: boolean;
  compactThresholdTokens: number;
  summarizeMaxTokens: number;
  summarizeInputMaxChars: number;
  summarizeModel: string;
  summarizeToolContentMaxChars: number;
  summarizePriorSummaryMaxChars: number;
  summarizeMaxTokensShort: number;
  summarizeShortPromptChars: number;
}

export interface RecoveryFeatureConfig {
  llmMaxRetries: number;
  llmRetryDelaysMs: readonly number[];
}

export interface HistoryFeatureConfig {
  enableMessageHistory: boolean;
  defaultMessageHistoryCount: number;
  messagesPageSize: number;
}

export interface LogFeatureConfig {
  level: string;
  debugLlmTools: boolean;
  console: boolean;
  file: boolean;
  files: {
    all: string;
    error: string;
  };
  maxSize: number;
  maxFiles: number;
}

export interface PermissionFeatureConfig {
  pendingTimeoutMs: number;
  pendingPollMs: number;
  sessionAllowTtlMs: number;
}

export interface HookFeatureConfig {
  enableAuditHook: boolean;
  enableArgsSizeCheck: boolean;
  maxToolArgsChars: number;
  externalHookTimeoutMs: number;
}

/** 对外暴露的记忆开关（不含密钥与 mission 文案） */
export interface PublicMemoryFeatureConfig {
  enabled: boolean;
  bankIdPrefix: string;
}

export interface SystemToolDescriptor {
  codeName: string;
  label: string;
  summary: string;
  description: string;
}

/** GET /api/config/features 响应 config 字段 */
export interface PublicFeatureConfig {
  tools: ToolsFeatureConfig;
  chat: ChatFeatureConfig;
  context: ContextFeatureConfig;
  recovery: RecoveryFeatureConfig;
  history: HistoryFeatureConfig;
  log: LogFeatureConfig;
  permission: PermissionFeatureConfig;
  hook: HookFeatureConfig;
  memory: PublicMemoryFeatureConfig;
  systemTools: SystemToolDescriptor[];
}

export interface FeatureConfigApiSuccess {
  success: true;
  config: PublicFeatureConfig;
}

export interface FeatureConfigApiFailure {
  error: string;
  message?: string;
}

export type FeatureConfigApiResponse = FeatureConfigApiSuccess | FeatureConfigApiFailure;
