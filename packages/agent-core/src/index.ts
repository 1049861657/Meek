// Harness core
export { runAgentLoop } from './agent-loop.js';
export type {
  AgentLoopProvider,
  AgentPermissionContext,
  RunAgentLoopParams,
} from './agent-loop.js';

export type {
  ChatResponse,
  ChatTool,
  ChunkResponse,
  ExtendedDelta,
  InternalMessage,
  MessageSource,
  ModelResponseResult,
  PartialToolResult,
  ToolCallRecord,
  ToolOutputArtifact,
  UsageInfo,
} from './types.js';
export { TOOL_OUTPUT_ARTIFACT_TYPE } from './types.js';

export { normalizeMessages, MessageNormalizer, CANCELLED_TOOL_RESULT, findUnpairedToolCallIds } from './message-normalizer.js';
export type { ToolCallPairingIssue } from './message-normalizer.js';
export {
  applyPromptPipelineToMessages,
  buildAssembledSystemPreview,
  buildSystemPromptSectionPreviews,
  PROMPT_SECTION_ORDER,
  SystemPromptBuilder,
} from './prompt-pipeline.js';
export type {
  AssembledSystemPreview,
  PromptPipelineOptions,
  PromptSectionKey,
  PromptSectionPreview,
} from './prompt-pipeline.js';

export {
  applyContextBeforeLlm,
  buildCompactPromptFromMessages,
  buildMainModelContextPreview,
  cleanupExpiredAgentOutputs,
  compactHistory,
  estimateTokenCount,
  materializeToolOutput,
} from './context-budget.js';
export type {
  CompactSummarizeResult,
  ContextPreviewResult,
  MainModelContextPreviewOptions,
  MaterializedToolOutput,
} from './context-budget.js';

export {
  logAgentRunAudit,
  logLlmStepAudit,
  logRecoveryAudit,
  logToolCallAudit,
  toAuditUsage,
} from './audit.js';
export type {
  AgentRunAuditLog,
  AuditUsageSnapshot,
  LlmStepAuditLog,
  RecoveryKind,
  ToolCallAuditLog,
} from './audit.js';

export {
  addUsage,
  emitStepUsage,
  emptyUsage,
  hasUsage,
} from './usage-telemetry.js';

export { classifyLlmError, withLlmRetry } from './llm-retry.js';
export type { LlmRetryOutcome, WithLlmRetryResult } from './llm-retry.js';

export { checkPermission, resolvePermissionMode, buildArgsPreview } from './permission-gate.js';
export {
  initPermissionPending,
  resolvePermissionPending,
  waitForPermissionDecision,
} from './permission-pending.js';
export type { PermissionWaitOutcome } from './permission-pending.js';
export {
  assertPermissionSessionKey,
  grantSessionToolAllow,
  isSessionToolAllowed,
} from './permission-session.js';

export { ToolCallManager } from './tool-call-manager.js';
export { normalizeToolResult, ToolExecutor } from './tool-executor.js';
export { StreamingToolScheduler } from './streaming-tool-scheduler.js';
export type { StreamingToolExecuteFn } from './streaming-tool-scheduler.js';

export {
  createLoopState,
  buildPartialResults,
  emitMaxToolCallsReached,
  recordTurnEnd,
} from './loop-state.js';

export { runHooks, registerHook, ensureHooksInitialized } from './hook-runner.js';
export type { HookEventName, HookHandler, HookResult } from './hook-runner.js';
export { registerBuiltinHooks } from './hook-builtin.js';
export { registerChatPersistHook } from './chat-persist-hook.js';
export { registerMemoryRetainHook } from './memory-retain-hook.js';

export {
  applyTodoUpdate,
  createPlanningState,
  finalizePlanningAfterToolRound,
  TODO_TOOL_CODE_NAME,
} from './planning-state.js';
export type { PlanningState, TodoItem, TodoStatus } from './planning-state.js';

export {
  executeSystemTool,
  getDefaultEnabledSystemToolNames,
  getSystemToolSchemas,
  isSystemTool,
  listSystemToolDescriptors,
} from './system-tools/system-tool-registry.js';
export type { SystemToolContext, SystemToolDescriptor } from './system-tools/system-tool-registry.js';
export { READ_PERSISTED_OUTPUT_CODE_NAME } from './system-tools/read-persisted-output.js';

export { ToolPolicyService } from './services/tool-policy.service.js';
export { ToolNameCodec } from './lib/tool-name-codec.js';
export { Logger } from './lib/logger.js';
export { resolveMcpPoolKey } from './lib/mcp-pool-key.js';

export {
  resolveMemoryPipelineContext,
  buildRetainContent,
  extractRecallQuery,
} from './memory-pipeline-context.js';
export type { MemoryPipelineContext, RetainPayload } from './memory-pipeline-context.js';

// Config
export {
  ChatConfig,
  ContextConfig,
  FeatureConfig,
  HookConfig,
  MemoryConfig,
  PermissionConfig,
  PlanningConfig,
  RecoveryConfig,
  ToolsConfig,
  isHindsightMemoryConfigured,
  resolveCompactModel,
  resolveEnableAutoCompact,
  resolveMaxToolCallRounds,
  resolveSkipMemory,
  resolveSummarizeMaxTokens,
} from './config/feature-config.js';

export type {
  PermissionBehavior,
  PermissionCheckContext,
  PermissionDecision,
  PermissionMode,
  PermissionResolveDecision,
} from './config/permission.types.js';
export {
  parsePermissionMode,
  parseImPermissionMode,
} from './config/permission.types.js';

export {
  PERMISSION_ALLOW_READONLY_PATTERNS,
  PERMISSION_DENY_PATTERNS,
  isMcpCodeName,
  matchesAnyPattern,
  matchesPermissionPattern,
} from './config/permission-defaults.js';

// Providers
export { AiProvider } from './providers/ai-provider.js';
export {
  aiService,
  ensureProvidersInitialized,
  getProviderForUser,
  initializeProviders,
  invalidateProviderCache,
  providerServices,
  reloadAiProviders,
} from './providers/ai-providers.js';
export {
  commitProviderConfig,
  forceCommitProviderConfig,
} from './providers/provider-config-sync.js';
export type { AIProvider, AIProvidersConfigType, AIModel } from './providers/provider-types.js';

// Ports
export {
  getMcpClientForUser,
  setMcpClientResolver,
  setMcpConnectionService,
} from './ports/mcp-client-port.js';
export type { McpClientPort, McpConnectionServicePort } from './ports/mcp-client-port.js';
export { getChatStore, setChatStore } from './ports/chat-store-port.js';
export type { ChatStorePort } from './ports/chat-store-port.js';
export {
  getMemoryPort,
  setMemoryPort,
  retainConversation,
  recallForPrompt,
} from './ports/memory-port.js';
export type { MemoryPort } from './ports/memory-port.js';
export {
  createHindsightMemoryPort,
  installMemoryPort,
} from './memory/install-memory-port.js';
export {
  debugPrompt,
  debugRecall,
  debugReflect,
  formatMemoryDebugError,
  getMemoryDebugMeta,
  MemoryDebugUnavailableError,
} from './memory/memory-debug.js';
export type {
  MemoryDebugMetaPayload,
  MemoryDebugPromptPayload,
  MemoryDebugRecallItem,
  MemoryDebugRecallPayload,
  MemoryDebugReflectPayload,
  MemoryDebugReflectReference,
} from './types/memory-debug.types.js';
export {
  getSetting,
  getMCPConfig,
  setMcpConfig,
  setToolPromptSetting,
} from './ports/settings-port.js';
export type { McpConfig } from './ports/settings-port.js';
export {
  getToolPreferencesService,
  setToolPreferencesStore,
} from './ports/tool-preferences-port.js';
export {
  getAIProvidersConfig,
  setAiProvidersConfig,
} from './ports/provider-config-port.js';

// MCP types
export type {
  CallToolOptions,
  MCPServerInfo,
  McpToolPreferencesStore,
  ToolInfo,
  UnifiedToolResult,
} from './mcp-types.js';
