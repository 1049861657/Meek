import { ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs';

import type { PlanningState, TodoItem } from './planning-state.js';
import type { UnifiedToolResult } from './mcp-types.js';

/** P1-01-12：大 tool 输出落盘元数据（Harness / SSE / UI） */
export const TOOL_OUTPUT_ARTIFACT_TYPE = 'tool_output_artifact' as const;

export interface ToolOutputArtifact {
  type: typeof TOOL_OUTPUT_ARTIFACT_TYPE;
  toolCallId: string;
  bytes: number;
  filePath: string;
  createdAt: string;
}

export interface MessageInternalMeta {
  artifact?: ToolOutputArtifact;
}

/** 内部消息来源（Harness 上下文构建 / 审计，不发送给 LLM API） */
export type MessageSource =
  | 'user'
  | 'tool'
  | 'reminder'
  | 'compact'
  | 'system'
  | 'summary'
  | 'hook'
  // T4-03：已登录会话从 ChatMessage 取回的历史，落库时据此跳过（不重复 append）
  | 'persisted';

/**
 * 内部消息扩展字段规范（P0-02）
 *
 * 内部 `messages[]` 与 API `messages[]` 分离；发送前由 `normalizeMessages()` 剥离。
 * - `_source`：消息来源，便于 Harness 区分用户输入、工具回写、压缩替换等
 * - `_internal`：任意内部标记（如 compact 批次 id、requestId）
 * - `_timestamp`：消息创建时间（ISO 8601）
 */
export interface InternalMessageExtensions {
  _source?: MessageSource;
  _internal?: MessageInternalMeta;
  _timestamp?: string;
  /** DeepSeek 等 reasoning 模型扩展字段，发送 API 前由 normalizeMessages 保留 */
  reasoning_content?: string;
}

/** Harness 内部消息块（可含扩展字段） */
export type InternalMessage = ChatCompletionMessageParam & InternalMessageExtensions;

export type TransitionReason = 'tool_result' | 'end' | 'max_rounds' | null;

/** 触顶时未完成/中断的工具摘要（P0-05-02 SSE partialResults） */
export interface PartialToolResult {
  id: string;
  name: string;
  codeName: string;
  status: 'pending' | 'interrupted';
  round?: number;
}

/** Agent Loop 运行时状态 */
export interface LoopState {
  messages: InternalMessage[];
  turnCount: number;
  transitionReason: TransitionReason;
  planning: PlanningState;
}

/** 中断/恢复状态骨架（P1 控制面扩展） */
export interface RecoveryState {
  interruptedAtTurn: number;
  pendingToolCallIds: string[];
  reason: string;
}

/** SSE 流式 chunk 结构 */
export interface ChunkResponse {
  content?: string;
  reasoning_content?: string;
  tool_call?: {
    index: number;
    id: string;
    name?: string;
    /** system 内置工具 vs MCP 远程工具（UI 区分样式） */
    source?: 'system' | 'mcp';
  };
  tool_call_update?: {
    index: number;
    completeArguments?: string;
    tool_call_id?: string;
  };
  tool_call_result?: {
    name: string;
    result: unknown;
    error?: boolean;
    tool_call_id?: string;
    index?: number;
    execution_time?: number;
    /** P1-01-12：大结果落盘元数据（UI 卡片） */
    artifact?: ToolOutputArtifact;
    /** P2-04：标准化工具结果（UI 优先展示 preview + status） */
    unified?: UnifiedToolResult;
  };
  /** 单轮 LLM 完成后的 token 统计（与 tool_call_result 解耦） */
  step_usage?: {
    round: number;
    step: UsageInfo;
    cumulative: UsageInfo;
  };
  tool_progress?: {
    index: number;
    progress: number;
    total?: number;
    message?: string;
    elapsed_ms?: number;
  };
  special_notice?: {
    type: string;
    title: string;
    message: string;
    level: 'info' | 'warning' | 'error';
  };
  error?: string;
  /** 自动上下文摘要已执行（SSE 侧栏展示「已压缩」） */
  contextCompacted?: boolean;
  /** 自动压缩生成的摘要正文（供客户端固化基线） */
  summaryContent?: string;
  /** P3-01：会话内 Todo 快照（驱动侧栏 UI） */
  planning_update?: {
    items: TodoItem[];
  };
  /** P1-03：工具执行前需用户确认（仅 interactive 确认模式 + Web） */
  permission_request?: {
    tool_call_id: string;
    codeName: string;
    toolName: string;
    argsPreview: string;
    reason: string;
    /** 与 grant/check 一致的权限会话键 */
    permissionSessionKey: string;
  };
  [key: string]: unknown;
}

/** 流式 delta 扩展（reasoning_content / tool_calls） */
export interface ExtendedDelta {
  content?: string;
  reasoning_content?: string;
  tool_calls?: Array<{
    index: number;
    id?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
  [key: string]: unknown;
}

/** 工具调用记录 */
export interface ToolCallRecord {
  id: string;
  codeName: string;
  name: string;
  arguments: Record<string, unknown>;
  argumentsText?: string;
  result?: unknown;
  meta?: {
    round?: number;
    localIndex?: number;
    globalIndex?: number;
    source?: 'system' | 'mcp';
    createdAt?: string;
    status?: 'pending' | 'executing' | 'completed' | 'error' | 'interrupted';
    /** 实际 execute 开始时刻（流式参数齐后立即执行） */
    executionStartedAt?: string;
    completedAt?: string;
    errorMessage?: string;
    interruptReason?: string;
    executionTime?: number;
    /** P1-01-12：落盘元数据（会话重放写入 _internal） */
    artifact?: ToolOutputArtifact;
  };
}

/** 使用量统计 */
export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** 聊天响应结果 */
export interface ChatResponse {
  content: string;
  model: string;
  tool_calls?: ToolCallRecord[];
  reasoning_content?: string;
  finish_reason?: string;
  usage: UsageInfo;
}

/** Chat Completions 兼容的工具函数定义 */
export interface ChatFunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** Chat Completions 兼容的工具定义 */
export interface ChatTool {
  type: 'function';
  function: ChatFunctionDefinition;
}

/** processModelResponse 返回结构 */
export interface ModelResponseResult {
  fullContent: string;
  fullReasoningContent: string;
  usage: UsageInfo | null;
  finishReasonResult: string | undefined | null;
  hasNewToolCalls: boolean;
  newToolCalls: ToolCallRecord[];
}
