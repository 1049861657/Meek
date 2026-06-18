import { Logger } from './lib/logger.js';
import { ToolsConfig } from './config/feature-config.js';
import { getMcpClientForUser } from './ports/mcp-client-port.js';
import {
  logAgentRunAudit,
  logLlmStepAudit,
  logRecoveryAudit,
  toAuditUsage,
  type ToolCallAuditLog
} from './audit.js';
import {
  applyContextBeforeLlm,
  isContextSummaryMessage,
  materializeToolOutput
} from './context-budget.js';
import { runHooks } from './hook-runner.js';
import type { MessageInternalMeta } from './types.js';
import {
  buildPartialResults,
  createLoopState,
  emitMaxToolCallsReached,
  recordTurnEnd
} from './loop-state.js';
import { classifyLlmError, withLlmRetry, type LlmRetryOutcome } from './llm-retry.js';
import {
  buildArgsPreview,
  checkPermission
} from './permission-gate.js';
import {
  initPermissionPending,
  waitForPermissionDecision
} from './permission-pending.js';
import { ToolCallManager } from './tool-call-manager.js';
import {
  addUsage,
  emitStepUsage,
  emptyUsage,
  hasUsage
} from './usage-telemetry.js';
import type { PermissionMode } from './config/permission.types.js';
import type { ChannelId } from '@meek/shared';
import {
  finalizePlanningAfterToolRound,
  TODO_TOOL_CODE_NAME
} from './planning-state.js';
import { READ_PERSISTED_OUTPUT_CODE_NAME } from './system-tools/read-persisted-output.js';
import {
  executeSystemTool,
  isSystemTool,
  type SystemToolContext
} from './system-tools/system-tool-registry.js';
import type { MemoryPipelineContext } from './memory-pipeline-context.js';
import { ToolPolicyService } from './services/tool-policy.service.js';
import { normalizeToolResult } from './tool-executor.js';
import {
  ChatResponse,
  ChunkResponse,
  InternalMessage,
  ToolCallRecord,
  ToolOutputArtifact,
  ModelResponseResult,
  ChatTool,
  UsageInfo
} from './types.js';

interface ToolResultPayload {
  tool_call_id: string;
  content: string;
  artifact?: ToolOutputArtifact;
  injectedMessage?: string;
}

/** Provider 层能力：Harness 通过此接口调用 LLM，不直接依赖 OpenAI 类 */
export interface AgentLoopProvider {
  providerName: string;
  createRequestParams(
    messages: InternalMessage[],
    model: string,
    temperature: number,
    maxTokens: number,
    tools: ChatTool[],
    stream: boolean
  ): Record<string, unknown>;
  createCompletionStream(
    requestParams: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<AsyncIterable<unknown>>;
  createCompletion(
    requestParams: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<unknown>;
  processModelResponse(
    stream: AsyncIterable<unknown>,
    round: number,
    toolManager: ToolCallManager,
    fullContent: string,
    fullReasoningContent: string,
    usage: UsageInfo | null,
    finishReasonResult: string | undefined | null,
    onChunk: (chunk: ChunkResponse, done: boolean) => void
  ): Promise<ModelResponseResult>;
  processNonStreamResponse(
    response: unknown,
    round: number,
    toolManager: ToolCallManager,
    fullContent: string,
    fullReasoningContent: string,
    usage: UsageInfo | null,
    finishReasonResult: string | undefined | null,
    onChunk: (chunk: ChunkResponse, done: boolean) => void
  ): Promise<ModelResponseResult>;
}

/** P1-03：Harness 工具权限上下文 */
export interface AgentPermissionContext {
  channel: ChannelId;
  sessionKey: string;
  permissionMode: PermissionMode;
}

export interface RunAgentLoopParams {
  messages: InternalMessage[];
  chatTools: ChatTool[];
  model: string;
  temperature: number;
  maxTokens: number;
  maxToolCallRounds?: number;
  stream?: boolean;
  signal?: AbortSignal;
  requestId?: string;
  /** 超阈时由 Provider 注入的摘要压缩 */
  summarizeFn?: (messages: InternalMessage[]) => Promise<InternalMessage[]>;
  /** 本轮 LLM 前触发自动摘要压缩时回调（用于 SSE / UI） */
  onContextCompacted?: (summaryContent: string) => void;
  onChunk: (chunk: ChunkResponse, done: boolean) => void;
  provider: AgentLoopProvider;
  permission?: AgentPermissionContext;
  /** P3-02-B：跨会话 memory 上下文（recall 已在 formatMessages 完成；此处供 SessionEnd retain） */
  memoryContext?: MemoryPipelineContext;
  /** T4-03-04：已登录会话落库目标（透传给 SessionEnd 落库 hook）；guest 无此字段 */
  persistContext?: { userId: string; chatSessionId: string };
  /** T4-06-05：per-user MCP 连接池键；null = seed 池；缺省同 null */
  configUserId?: string | null;
}

/**
 * Agent Loop 主入口：流式多轮工具调用 orchestration
 */
export async function runAgentLoop(params: RunAgentLoopParams): Promise<ChatResponse> {
  const {
    messages,
    chatTools,
    model,
    temperature,
    maxTokens,
    maxToolCallRounds = ToolsConfig.maxToolCallRounds,
    stream = true,
    signal,
    requestId = '',
    summarizeFn,
    onContextCompacted,
    onChunk,
    provider,
    permission,
    memoryContext,
    persistContext,
    configUserId
  } = params;

  const activeMcpClient = getMcpClientForUser(configUserId ?? null);

  const prepareContext = async (round: number): Promise<void> => {
    const compacted = await applyContextBeforeLlm(messages, { requestId, round, summarizeFn });
    if (compacted) {
      if (requestId) {
        logRecoveryAudit({
          requestId,
          round,
          recoveryKind: 'compact',
          reason: 'auto_compact_before_llm'
        });
      }
      const summary = messages.find(m => isContextSummaryMessage(m));
      const summaryContent =
        summary && typeof summary.content === 'string' ? summary.content : '';
      onContextCompacted?.(summaryContent);
    }
  };

  const toolManager = new ToolCallManager(provider.providerName, onChunk);
  const allowedCodeNames = ToolPolicyService.buildAllowedCodeNames(chatTools);
  const readBackEnabled = allowedCodeNames.has(READ_PERSISTED_OUTPUT_CODE_NAME);
  const loopState = createLoopState(messages);

  const systemToolCtx: SystemToolContext = {
    signal,
    planning: loopState.planning,
    onPlanningUpdated: (items) => {
      onChunk({ planning_update: { items: items.map(item => ({ ...item })) } }, false);
    }
  };

  const sessionHook = await runHooks('SessionStart', {
    requestId,
    model,
    messageCount: messages.length
  });
  if (sessionHook.exit_code === 2 && sessionHook.message.trim().length > 0) {
    messages.push({
      role: 'user',
      content: sessionHook.message,
      _source: 'hook'
    });
  }

  const emitPostToolUse = async (
    audit: ToolCallAuditLog,
    output: string
  ): Promise<string | undefined> => {
    const post = await runHooks('PostToolUse', {
      ...audit,
      output
    });
    if (post.exit_code === 2 && post.message.trim().length > 0) {
      return post.message;
    }
    return undefined;
  };

  const executeOneToolCall = async (
    toolCall: ToolCallRecord
  ): Promise<ToolResultPayload> => {
    const globalIndex = toolCall.meta?.globalIndex as number;
    const current = toolManager.getToolCall(globalIndex) ?? toolCall;

    if (current.meta?.status === 'completed') {
      return { tool_call_id: current.id, content: String(current.result ?? '') };
    }
    if (current.meta?.status === 'error') {
      const errContent = String(current.result ?? current.meta.errorMessage ?? '');
      return { tool_call_id: current.id, content: errContent };
    }

    const round = toolManager.getCurrentRound();
    const auditBase = {
      requestId,
      round,
      toolName: current.name,
      codeName: current.codeName,
      serverId: isSystemTool(current.codeName)
        ? null
        : activeMcpClient.getServerIdForTool(current.codeName) ?? null
    };

    toolManager.markExecutionStart(globalIndex);
    const startedAt = Date.now();

    const finishWithError = async (
      errorMessage: string,
      permissionDecision?: string
    ): Promise<ToolResultPayload> => {
      const durationMs = Date.now() - startedAt;
      const injectedMessage = await emitPostToolUse(
        {
          ...auditBase,
          durationMs,
          success: false,
          error: errorMessage,
          permissionDecision
        },
        errorMessage
      );
      const errSource = isSystemTool(current.codeName) ? 'system' as const : 'mcp' as const;
      toolManager.setToolResult(
        globalIndex,
        errorMessage,
        true,
        errorMessage,
        durationMs,
        undefined,
        { source: errSource, tool: current.name, status: 'error', preview: errorMessage }
      );
      return {
        tool_call_id: current.id,
        content: errorMessage,
        injectedMessage
      };
    };

    try {
      let permissionAudit: string | undefined;
      if (permission) {
        const perm = await checkPermission({
          codeName: current.codeName,
          toolName: current.name,
          arguments: current.arguments,
          mode: permission.permissionMode,
          channel: permission.channel,
          sessionKey: permission.sessionKey,
          requestId
        });
        permissionAudit = `${perm.behavior}:${perm.reason}`;

        if (perm.behavior === 'deny') {
          let errorMessage: string;
          if (perm.reason === 'matched_deny_rule') {
            errorMessage = '该工具在系统黑名单内，无法执行';
          } else if (perm.reason === 'mode:locked_not_allowlisted') {
            errorMessage = '只读模式下，仅只读工具可执行';
          } else {
            errorMessage = `工具未获允许（${perm.reason}）`;
          }
          return finishWithError(errorMessage, `deny:${perm.reason}`);
        }

        if (perm.behavior === 'ask') {
          await initPermissionPending(requestId, current.id);
          onChunk(
            {
              permission_request: {
                tool_call_id: current.id,
                codeName: current.codeName,
                toolName: current.name,
                argsPreview: buildArgsPreview(current.arguments),
                reason: perm.reason,
                permissionSessionKey: permission.sessionKey
              }
            },
            false
          );

          const waitOutcome = await waitForPermissionDecision(
            requestId,
            current.id,
            signal
          );

          if (waitOutcome === 'denied' || waitOutcome === 'timeout') {
            const errorMessage =
              waitOutcome === 'timeout'
                ? '确认超时，工具未执行'
                : '你已拒绝执行该工具';
            return finishWithError(errorMessage, `ask_${waitOutcome}`);
          }
          permissionAudit = 'allow:ask_approved';
        }
      }

      const preTool = await runHooks('PreToolUse', {
        requestId,
        round,
        toolName: current.name,
        codeName: current.codeName,
        input: current.arguments
      });
      if (preTool.exit_code === 1) {
        const blockMessage = preTool.message.trim().length > 0
          ? preTool.message
          : '工具调用被 Hook 阻止';
        return finishWithError(blockMessage);
      }
      if (preTool.exit_code === 2 && preTool.message.trim().length > 0) {
        messages.push({
          role: 'user',
          content: preTool.message,
          _source: 'hook'
        });
      }

      const policy = ToolPolicyService.assertToolCallable(
        current.codeName,
        allowedCodeNames
      );
      if (!policy.allowed) {
        return finishWithError(policy.message, 'deny:tool_not_enabled');
      }

      const isExecuteApi = current.name === 'executeApi';
      const toolResult = isSystemTool(current.codeName)
        ? await executeSystemTool(current.codeName, current.arguments, systemToolCtx)
        : await activeMcpClient.callTool<unknown>(
          current.codeName,
          current.arguments,
          {
            signal,
            ...(isExecuteApi ? {
              supportsProgress: true,
              onProgress: (progress, total, message, elapsed_ms) => {
                toolManager.setToolProgress(globalIndex, progress, total, message, elapsed_ms);
              }
            } : {})
          }
        );

      const mcpServerId = auditBase.serverId ?? undefined;
      const unified = normalizeToolResult({
        source: isSystemTool(current.codeName) ? 'system' : 'mcp',
        tool: current.name,
        serverId: mcpServerId,
        serverName: mcpServerId ? activeMcpClient.getServerName(mcpServerId) : undefined,
        raw: toolResult
      });
      const materialized = await materializeToolOutput(current.id, unified.preview, {
        readBackEnabled
      });
      if (materialized.artifact) {
        unified.rawPath = materialized.artifact.filePath;
      }
      const durationMs = Date.now() - startedAt;
      const injectedMessage = await emitPostToolUse(
        {
          ...auditBase,
          durationMs,
          success: unified.status === 'success',
          permissionDecision: permissionAudit
        },
        materialized.content
      );
      toolManager.setToolResult(
        globalIndex,
        materialized.content,
        unified.status === 'error',
        undefined,
        durationMs,
        materialized.artifact,
        unified
      );
      return {
        tool_call_id: current.id,
        content: materialized.content,
        artifact: materialized.artifact,
        injectedMessage
      };
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'APIUserAbortError')) {
        throw error;
      }
      const errorMessage = `工具${current.name}执行失败: ${error instanceof Error ? error.message : String(error)}`;
      return finishWithError(errorMessage);
    }
  };

  toolManager.attachStreamingExecutor(executeOneToolCall);

  let fullContent = '';
  let fullReasoningContent = '';
  let usage: UsageInfo | null = null;
  let cumulativeLlmUsage = emptyUsage();

  const recordLlmStepUsage = (round: number, stepUsage: UsageInfo | null | undefined): void => {
    if (!hasUsage(stepUsage)) {
      return;
    }
    cumulativeLlmUsage = addUsage(cumulativeLlmUsage, stepUsage);
    emitStepUsage(onChunk, round, stepUsage, cumulativeLlmUsage);
  };

  const auditLlmStep = (
    round: number,
    stepUsage: UsageInfo | null | undefined,
    recovery: LlmRetryOutcome
  ): void => {
    if (!requestId) {
      return;
    }
    if (!hasUsage(stepUsage) && recovery.retryAttempts === 0) {
      return;
    }
    logLlmStepAudit({
      requestId,
      round,
      stepTokens: hasUsage(stepUsage) ? toAuditUsage(stepUsage) : undefined,
      cumulativeTokens: toAuditUsage(cumulativeLlmUsage),
      recoveryKind: recovery.recoveryKind,
      retryAttempts: recovery.retryAttempts > 0 ? recovery.retryAttempts : undefined
    });
  };

  let finishReasonResult: string | undefined | null = null;

  const invokeModelRound = async (
    round: number,
    requestParams: Record<string, unknown>
  ): Promise<ModelResponseResult> => {
    const { value, recovery } = await withLlmRetry(
      async () => {
        if (stream) {
          const responseStream = await provider.createCompletionStream(requestParams, signal);
          return provider.processModelResponse(
            responseStream,
            round,
            toolManager,
            fullContent,
            fullReasoningContent,
            usage,
            finishReasonResult,
            onChunk
          );
        }

        const response = await provider.createCompletion(requestParams, signal);
        return provider.processNonStreamResponse(
          response,
          round,
          toolManager,
          fullContent,
          fullReasoningContent,
          usage,
          finishReasonResult,
          onChunk
        );
      },
      {
        label: `round${round}`,
        providerName: provider.providerName,
        signal
      }
    );
    recordLlmStepUsage(round, value.usage);
    auditLlmStep(round, value.usage, recovery);
    return value;
  };

  interface ToolRoundResult {
    shouldContinue: boolean;
    nextAssistantReasoning: string;
  }

  const processToolCalls = async (
    toolCalls: ToolCallRecord[],
    assistantReasoning: string
  ): Promise<ToolRoundResult> => {
    if (toolCalls.length === 0) {
      return { shouldContinue: false, nextAssistantReasoning: '' };
    }

    const round = toolManager.getCurrentRound();

    const assistantMessage: InternalMessage = {
      role: 'assistant',
      content: fullContent || null,
      tool_calls: toolCalls.map(t => ({
        id: t.id,
        function: {
          name: t.codeName,
          arguments: JSON.stringify(t.arguments)
        },
        type: 'function'
      })),
      _source: 'tool'
    };

    if (assistantReasoning) {
      assistantMessage.reasoning_content = assistantReasoning;
    }

    messages.push(assistantMessage);

    const globalIndices = toolCalls.map(tc => tc.meta?.globalIndex as number);
    await toolManager.awaitToolExecutions(globalIndices);

    const toolResultMessages = await Promise.all(toolCalls.map(async (toolCall) => {
      const globalIndex = toolCall.meta?.globalIndex as number;
      const current = toolManager.getToolCall(globalIndex) ?? toolCall;

      if (current.meta?.status === 'completed' || current.meta?.status === 'error') {
        return {
          tool_call_id: current.id,
          content: String(current.result ?? current.meta?.errorMessage ?? ''),
          artifact: current.meta?.artifact
        };
      }

      return executeOneToolCall(current);
    }));

    for (const result of toolResultMessages) {
      if (result.injectedMessage) {
        messages.push({
          role: 'user',
          content: result.injectedMessage,
          _source: 'hook'
        });
      }
      const internal: MessageInternalMeta | undefined = result.artifact
        ? { artifact: result.artifact }
        : undefined;
      messages.push({
        role: 'tool',
        content: result.content,
        tool_call_id: result.tool_call_id,
        _source: 'tool',
        _internal: internal
      });
    }

    let roundHadSuccessfulTodo = false;
    for (const toolCall of toolCalls) {
      if (toolCall.codeName !== TODO_TOOL_CODE_NAME) {
        continue;
      }
      const globalIndex = toolCall.meta?.globalIndex as number;
      const current = toolManager.getToolCall(globalIndex) ?? toolCall;
      if (current.meta?.status === 'completed') {
        roundHadSuccessfulTodo = true;
      }
    }
    finalizePlanningAfterToolRound(
      messages,
      loopState.planning,
      roundHadSuccessfulTodo,
      requestId ? { requestId, round } : undefined
    );

    try {
      await prepareContext(round);
      const nextRequestParams = provider.createRequestParams(
        messages,
        model,
        temperature,
        maxTokens,
        chatTools,
        stream
      );

      const reasoningBeforeResponse = fullReasoningContent.length;
      const result = await invokeModelRound(round, nextRequestParams);

      fullContent = result.fullContent;
      fullReasoningContent = result.fullReasoningContent;
      usage = result.usage;
      finishReasonResult = result.finishReasonResult;
      const harnessTurn = round + 1;
      const reason = result.hasNewToolCalls ? 'tool_result' : 'end';
      recordTurnEnd(loopState, harnessTurn, reason);

      const nextAssistantReasoning = result.fullReasoningContent.slice(reasoningBeforeResponse);

      return {
        shouldContinue: result.hasNewToolCalls && result.newToolCalls.length > 0,
        nextAssistantReasoning
      };
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      Logger.error(
        'OPENAI',
        `[${provider.providerName}] 回合${round}: 获取模型回复失败: ${errMessage}`
      );
      if (requestId) {
        const kind = classifyLlmError(error);
        logRecoveryAudit({
          requestId,
          round,
          recoveryKind: kind === 'fail_fast' ? 'fail_fast' : 'fail',
          reason: errMessage
        });
      }
      onChunk({
        error: `获取模型回复失败: ${errMessage}`
      }, false);
      recordTurnEnd(loopState, round + 1, 'end');
    }

    return { shouldContinue: false, nextAssistantReasoning: '' };
  };

  let finalUsage = emptyUsage();

  // 解耦：客户端断流/异常时主循环抛出，SessionEnd（memory retain + 轮末落库）仍须执行，
  // 不丢已产出轮次（现网 SessionEnd 在循环后无 finally 保护，abort 会跳过——此处修复）
  try {
    await prepareContext(0);
    const requestParams = provider.createRequestParams(
      messages,
      model,
      temperature,
      maxTokens,
      chatTools,
      stream
    );

    const initialResult = await invokeModelRound(0, requestParams);

    fullContent = initialResult.fullContent;
    fullReasoningContent = initialResult.fullReasoningContent;
    usage = initialResult.usage;
    finishReasonResult = initialResult.finishReasonResult;
    const initialToolCount = toolManager.hasValidToolCalls()
      ? toolManager.getToolCallsByRound(0).length
      : 0;
    recordTurnEnd(loopState, 1, initialToolCount > 0 ? 'tool_result' : 'end');

    if (toolManager.hasValidToolCalls()) {
      toolManager.setCurrentRound(1);

      const initialToolCalls = toolManager.getToolCallsByRound(0);
      let roundResult = await processToolCalls(initialToolCalls, initialResult.fullReasoningContent);

      while (roundResult.shouldContinue && toolManager.getCurrentRound() < maxToolCallRounds) {
        toolManager.setCurrentRound(toolManager.getCurrentRound() + 1);
        const round = toolManager.getCurrentRound();

        if (round >= maxToolCallRounds) {
          Logger.warn('OPENAI', `已达到最大工具调用回合数 ${maxToolCallRounds}，停止后续调用`);
          toolManager.setReachedMaxRounds(true);

          const unprocessed = toolManager.getToolCallsByRound(round - 1);
          const partialResults = buildPartialResults(unprocessed);
          emitMaxToolCallsReached(onChunk, round, partialResults);
          recordTurnEnd(loopState, round + 1, 'max_rounds');
          break;
        }

        const roundToolCalls = toolManager.getToolCallsByRound(round - 1);
        roundResult = await processToolCalls(roundToolCalls, roundResult.nextAssistantReasoning);
      }

      toolManager.finalizeAllToolCalls();
    }

    onChunk({}, true);

    finalUsage = hasUsage(cumulativeLlmUsage)
      ? cumulativeLlmUsage
      : usage ?? emptyUsage();

    if (requestId) {
      const allTools = toolManager.getAllToolCalls();
      let toolSuccess = 0;
      let toolFail = 0;
      for (const tc of allTools) {
        if (tc.meta?.status === 'error') {
          toolFail += 1;
        } else if (tc.meta?.status === 'completed') {
          toolSuccess += 1;
        }
      }
      logAgentRunAudit({
        requestId,
        sessionKey: permission?.sessionKey,
        turnCount: loopState.turnCount,
        transitionReason: loopState.transitionReason,
        totalTokens: toAuditUsage(finalUsage),
        toolSuccess,
        toolFail,
        providerName: provider.providerName
      });
    }
  } finally {
    appendTerminalAssistantMessage(messages, fullContent, fullReasoningContent);
    await runHooks('SessionEnd', {
      requestId,
      messages: [...messages],
      bankId: memoryContext?.bankId,
      documentSessionId: memoryContext?.documentSessionId,
      skipMemory: memoryContext?.skipMemory ?? true,
      signal,
      ...(persistContext
        ? { userId: persistContext.userId, chatSessionId: persistContext.chatSessionId }
        : {})
    });
  }

  return {
    content: fullContent,
    reasoning_content: fullReasoningContent,
    tool_calls: toolManager.getAllToolCalls(),
    model,
    finish_reason: finishReasonResult || undefined,
    usage: finalUsage
  };
}

/**
 * 终轮 assistant 答复（fullContent/reasoning）未在循环内 push 进 messages，
 * SessionEnd（落库 / memory retain）前补入；abort 时为已产出的部分内容，同样保留。
 */
function appendTerminalAssistantMessage(
  messages: InternalMessage[],
  fullContent: string,
  fullReasoningContent: string
): void {
  if (fullContent.trim().length === 0 && fullReasoningContent.trim().length === 0) {
    return;
  }
  const last = messages[messages.length - 1];
  if (
    last?.role === 'assistant' &&
    typeof last.content === 'string' &&
    last.content === fullContent
  ) {
    return;
  }
  const terminal: InternalMessage = { role: 'assistant', content: fullContent || null };
  if (fullReasoningContent) {
    terminal.reasoning_content = fullReasoningContent;
  }
  messages.push(terminal);
}
