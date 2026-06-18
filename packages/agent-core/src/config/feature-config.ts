/**
 * Agent 相关特性配置（Resolver 兜底）
 */

export const HookConfig = {
  enableAuditHook: true,
  enableArgsSizeCheck: true,
  maxToolArgsChars: 100_000,
  externalHookTimeoutMs: 30_000,
};

export const PermissionConfig = {
  pendingTimeoutMs: 30 * 60 * 1000,
  pendingPollMs: 1000,
  sessionAllowTtlMs: 24 * 60 * 60 * 1000,
};

export const ToolsConfig = {
  enableMCPTools: true,
  enablePrompts: true,
  maxToolCallRounds: 25,
  maxToolCallRoundsLimit: 100,
};

export const McpPoolConfig = {
  maxClients: 20,
  clientTtlMs: 30 * 60 * 1000,
  configCacheTtlMs: 60_000,
  configCacheMaxEntries: 128,
  toolsCacheTtlMs: 5 * 60 * 1000,
  reconnectIntervalMs: 8 * 60 * 60 * 1000,
  providerBucketMax: 50,
  providerBucketTtlMs: 30 * 60 * 1000,
};

export const PlanningConfig = {
  maxTodoItems: 20,
  planRefreshRounds: 3,
};

const HINDSIGHT_CLOUD_BASE_URL = 'https://api.hindsight.vectorize.io';

function isLocalHindsightBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

export const MemoryConfig = {
  baseUrl: process.env.HINDSIGHT_BASE_URL?.trim() || HINDSIGHT_CLOUD_BASE_URL,
  apiKey: process.env.HINDSIGHT_API_KEY?.trim() || '',
  bankIdPrefix: 'meek',
  retainMission:
    'Always extract world/experience facts：用户明确偏好与纠正；关于人物、项目、团队与环境的客观陈述；' +
    '用户自述的身份、角色与关系。当用户更正先前说法或描述状态变化时，提取最新状态并保留变化关系' +
    '（例如「曾为 X，现为 Y」），勿并列两条互斥结论。' +
    'Ignore：问候寒暄、对助手身份的闲聊、会话元数据、目录列表、任务进度、' +
    '工具实时输出摘要、临时分支名、密钥与 token。事实一律用简体中文书写。',
  observationsMission:
    'Observation 是从多条世界/经历事实自动归纳的巩固知识，跨会话仍成立' +
    '（可含偏好、模式、关系；非任务进度、非目录快照、非工具输出）。' +
    '综合时识别重复模式与状态变化；当新事实与旧观察矛盾时，' +
    '以更新鲜、更明确的用户表述为准，在单条观察中体现状态演变（曾为 X，现为 Y），' +
    '勿保留两条互斥的并行结论。忽略一次性寒暄、助手身份闲聊、单轮工具结果、临时分支名与密钥。' +
    '一律用简体中文书写。',
  retainExtractionMode: 'concise',
  retainContext: '',
  recallTypes: ['observation', 'world'] as const,
  recallMaxTokens: 4096,
  recallQueryMaxChars: 500,
  sessionRetainMaxChars: 8000,
  perMessageRetainMaxChars: 2000,
};

export function isHindsightMemoryConfigured(): boolean {
  if (!MemoryConfig.baseUrl) {
    return false;
  }
  if (isLocalHindsightBaseUrl(MemoryConfig.baseUrl)) {
    return true;
  }
  return MemoryConfig.apiKey.length > 0;
}

export function resolveSkipMemory(requestValue: unknown): boolean {
  if (!isHindsightMemoryConfigured()) {
    return true;
  }
  return requestValue === true;
}

export function resolveMaxToolCallRounds(requestValue: unknown): number {
  const fallback = ToolsConfig.maxToolCallRounds;
  if (typeof requestValue !== 'number' || !Number.isFinite(requestValue)) {
    return fallback;
  }
  return Math.min(
    ToolsConfig.maxToolCallRoundsLimit,
    Math.max(1, Math.floor(requestValue))
  );
}

export const ChatConfig = {
  defaultTemperature: 0.7,
  defaultMaxTokens: 2048,
  defaultStreamMode: true,
};

export const ContextConfig = {
  charsPerTokenLatin: 4,
  charsPerTokenCjk: 1,
  persistThresholdChars: 30_000,
  persistPreviewChars: 2000,
  agentOutputsDir: '.agent-outputs',
  agentOutputsTtlDays: 7,
  readPartialDefaultLines: 80,
  microCompactKeepRecent: 3,
  enableAutoCompact: false,
  compactThresholdTokens: 32_000,
  summarizeMaxTokens: 4096,
  summarizeInputMaxChars: 40_000,
  summarizeModel: '',
  summarizeToolContentMaxChars: 3000,
  summarizePriorSummaryMaxChars: 20_000,
  summarizeMaxTokensShort: 800,
  summarizeShortPromptChars: 6000,
};

export const RecoveryConfig = {
  llmMaxRetries: 1,
  llmRetryDelaysMs: [1000] as const,
};

export function resolveSummarizeMaxTokens(serializedPromptChars: number): number {
  if (serializedPromptChars <= ContextConfig.summarizeShortPromptChars) {
    return ContextConfig.summarizeMaxTokensShort;
  }
  if (serializedPromptChars <= 20_000) {
    return 2000;
  }
  return ContextConfig.summarizeMaxTokens;
}

export function resolveEnableAutoCompact(requestValue: unknown): boolean {
  if (typeof requestValue === 'boolean') {
    return requestValue;
  }
  return ContextConfig.enableAutoCompact;
}

export function resolveCompactModel(
  requestCompactModel: unknown,
  providerDefaultModel: string
): string {
  if (typeof requestCompactModel === 'string' && requestCompactModel.trim().length > 0) {
    return requestCompactModel.trim();
  }
  if (ContextConfig.summarizeModel.trim().length > 0) {
    return ContextConfig.summarizeModel.trim();
  }
  return providerDefaultModel;
}

export const HistoryConfig = {
  enableMessageHistory: true,
  defaultMessageHistoryCount: 20,
  messagesPageSize: 50,
};

export const LogConfig = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  debugLlmTools: false,
  console: true,
  file: false,
  files: {
    all: 'logs/app.log',
    error: 'logs/error.log',
  },
  maxSize: 5 * 1024 * 1024,
  maxFiles: 5,
};

export const FeatureConfig = {
  tools: ToolsConfig,
  chat: ChatConfig,
  context: ContextConfig,
  recovery: RecoveryConfig,
  history: HistoryConfig,
  log: LogConfig,
  permission: PermissionConfig,
  hook: HookConfig,
  memory: MemoryConfig,
};
