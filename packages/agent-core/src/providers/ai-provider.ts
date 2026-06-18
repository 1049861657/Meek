import { OpenAI as OpenAIClient } from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs';
import type {
  AgentLoopProvider,
  AgentPermissionContext,
} from '../agent-loop.js';
import type { ToolCallManager } from '../tool-call-manager.js';
import { normalizeMessages } from '../message-normalizer.js';
import {
  ChatResponse,
  ChunkResponse,
  ExtendedDelta,
  InternalMessage,
  ToolCallRecord,
  ModelResponseResult,
  ChatTool,
  UsageInfo
} from '../types.js';
import type {
  CompactSummarizeResult,
  ContextPreviewResult,
  MainModelContextPreviewOptions,
} from '../context-compact.js';
import {
  ChatConfig,
  ContextConfig,
  resolveCompactModel,
  resolveEnableAutoCompact,
  resolveSummarizeMaxTokens,
  ToolsConfig
} from '../config/feature-config.js';
import { getMcpClientForUser, getMcpConnectionService } from '../ports/mcp-client-port.js';
import { resolveMcpPoolKey } from '../lib/mcp-pool-key.js';
import { getChatStore } from '../ports/chat-store-port.js';
import { getMCPConfig } from '../ports/settings-port.js';
import { ToolPolicyService } from '../services/tool-policy.service.js';
import { getToolPreferencesService } from '../ports/tool-preferences-port.js';
import type { ResolvedProfile } from '@meek/shared';
import { AIProvider } from './provider-types.js';
import { Logger } from '../lib/logger.js';
import {
  applyPromptPipelineToMessages,
  type PromptPipelineOptions
} from '../prompt-pipeline.js';
import { resolveMemoryPipelineContext } from '../memory-pipeline-context.js';
import {
  getDefaultEnabledSystemToolNames,
  getSystemToolSchemas
} from '../system-tools/system-tool-registry.js';
import { logLlmToolsIfEnabled } from '../lib/llm-tools-debug.js';

/**
 * AI 提供商客户端（Provider 层：模型 I/O + 流式解析，OpenAI SDK 兼容 Chat Completions）
 */
export class AiProvider {
  // 公共属性
  public client: OpenAIClient;
  public config: AIProvider;
  public providerName: string;
  
  // 配置分组
  private chatConfig: {
    defaultTemperature: number;
    defaultMaxTokens: number;
  };
  
  private toolsConfig: {
    enableMCPTools: boolean;
    enablePrompts: boolean;
  };

  private chatToolsCache = new Map<string, { tools: ChatTool[]; createdAt: number }>();
  private static readonly CHAT_TOOLS_CACHE_TTL_MS = 60_000;
  
  /**
   * 构造函数
   * @param providerConfig 提供商配置对象
   */
  constructor(providerConfig: AIProvider) {
    // 加载全局默认配置
    this.chatConfig = {
      defaultTemperature: ChatConfig.defaultTemperature,
      defaultMaxTokens: ChatConfig.defaultMaxTokens
    };
    
    this.toolsConfig = {
      enableMCPTools: ToolsConfig.enableMCPTools,
      enablePrompts: ToolsConfig.enablePrompts
    };
    
    this.config = providerConfig;
    this.providerName = providerConfig.name;
    
    // 覆盖默认值（如果提供商有指定）
    if (this.config.defaultTemperature) {
      this.chatConfig.defaultTemperature = this.config.defaultTemperature;
    }
    
    if (this.config.defaultMaxTokens) {
      this.chatConfig.defaultMaxTokens = this.config.defaultMaxTokens;
    }
    
    // 创建客户端
    this.client = new OpenAIClient({
      apiKey: this.config.apiKey,
      baseURL: this.config.apiUrl
    });
    
    Logger.info('OPENAI', `初始化API客户端: ${this.providerName}, API URL: ${this.config.apiUrl}`);
  }
  
  /**
   * 将MCP工具转换为OpenAI函数定义
   * @returns OpenAI工具定义列表
   */
  private async convertMcpToolsToChatFunctions(
    enabledServerIds?: string[],
    enabledToolCodeNames?: string[],
    configUserId?: string | null,
    chatRequestId?: string
  ): Promise<ChatTool[]> {
    try {
      const client = getMcpClientForUser(configUserId ?? null);
      let activeServerIds = enabledServerIds;
      if (enabledServerIds && enabledServerIds.length > 0) {
        if (chatRequestId) {
          const { reachableIds } = await getMcpConnectionService().ensureForChat(
            enabledServerIds,
            configUserId ?? null,
            chatRequestId
          );
          activeServerIds = reachableIds;
        } else {
          await client.ensureServersReachable(enabledServerIds, { mode: 'admin-probe' });
        }
      }
      const serverInfo = await client.getServerInfo();
      const mcpTools = serverInfo.tools;

      if (!mcpTools || mcpTools.length === 0) {
        return [];
      }

      const filterIds =
        activeServerIds ??
        (await getMCPConfig(configUserId ?? undefined)).enabledToolServerIds ??
        [];

      if (filterIds.length === 0) {
        return [];
      }

      const serverToolsMap = serverInfo.serverTools || {};
      const store = await getToolPreferencesService().getAll();
      const resolvedCodeNames =
        enabledToolCodeNames !== undefined
          ? enabledToolCodeNames
          : ToolPolicyService.resolveEnabledCodeNames(filterIds, serverToolsMap, store);

      const enabledSet = new Set(resolvedCodeNames);
      const filteredTools = mcpTools.filter((tool) => {
        let onServer = false;
        for (const serverId in serverToolsMap) {
          if (
            filterIds.includes(serverId) &&
            serverToolsMap[serverId]?.some((t) => t.codeName === tool.codeName)
          ) {
            onServer = true;
            break;
          }
        }
        if (!onServer) {
          return false;
        }
        return enabledSet.has(tool.codeName);
      });
      
      if (filteredTools.length > 0) {
        Logger.info('OPENAI', `使用 ${filteredTools.length} 个MCP工具`);
      }
      
      // 转换为OpenAI工具格式
      return Promise.all(filteredTools.map(async tool => {
        // 构建参数Schema
        const properties: Record<string, unknown> = {};
        const required: string[] = [];
        
        // 处理工具参数
        for (const param of tool.parameters) {
          properties[param.name] = {
            type: param.type,
            description: param.description
          };
          
          if (param.required) {
            required.push(param.name);
          }
        }
        
        return {
          type: "function" as const,
          function: {
            name: tool.codeName,
            description: tool.description,
            parameters: {
              type: "object",
              properties: properties,
              required: required
            }
          }
        };
      }));
    } catch (error) {
      Logger.error('OPENAI', '获取或转换MCP工具失败:', error);
      return [];
    }
  }
  
  /**
   * 格式化消息数组
   * @param message 消息文本或消息数组
   * @param enableTools 是否启用工具调用
   * @param enablePrompts 是否启用提示词
   * @returns 格式化后的消息数组
   */
  private buildPromptPipelineOptions(
    enableMcpTools: boolean,
    enablePrompts: boolean,
    resolvedProfile?: ResolvedProfile
  ): PromptPipelineOptions {
    return {
      enableTools: this.hasActiveToolCapabilities(enableMcpTools, resolvedProfile),
      enablePrompts,
      resolvedProfile
    };
  }

  private hasActiveToolCapabilities(
    enableMcpTools: boolean,
    resolvedProfile?: ResolvedProfile
  ): boolean {
    if (enableMcpTools) {
      return true;
    }
    const names = resolvedProfile?.enabledSystemToolNames;
    if (names === undefined) {
      return getDefaultEnabledSystemToolNames().length > 0;
    }
    return names.length > 0;
  }

  private resolveSystemToolSchemas(resolvedProfile?: ResolvedProfile): ChatTool[] {
    return getSystemToolSchemas(resolvedProfile?.enabledSystemToolNames);
  }

  private async formatMessages(
    message: string | InternalMessage[],
    enableMcpTools: boolean = false,
    enablePrompts: boolean = false,
    resolvedProfile?: ResolvedProfile,
    signal?: AbortSignal,
    requestId?: string
  ): Promise<InternalMessage[]> {
    const messages: InternalMessage[] = typeof message === 'string'
      ? [{ role: 'user', content: message, _source: 'user' }]
      : [...message];

    const memoryContext = resolveMemoryPipelineContext(messages, {
      skipMemory: resolvedProfile?.skipMemory,
      documentSessionId: resolvedProfile?.documentSessionId,
      identityScope: resolvedProfile?.memoryScope
    });

    return applyPromptPipelineToMessages(messages, {
      ...this.buildPromptPipelineOptions(enableMcpTools, enablePrompts, resolvedProfile),
      memoryContext,
      requestId,
      signal
    });
  }
  
  /**
   * 使用辅助函数获取工具定义列表
   * @param enableMcpTools 是否启用 MCP 工具
   * @returns 工具定义列表
   */
  private async getToolDefinitions(
    enableMcpTools: boolean,
    resolvedProfile?: ResolvedProfile,
    chatRequestId?: string
  ): Promise<ChatTool[]> {
    const systemTools = this.resolveSystemToolSchemas(resolvedProfile);
    if (!enableMcpTools) {
      return systemTools;
    }

    try {
      const serverIds = resolvedProfile?.mcpServerIds ?? [];
      const explicitToolNames = resolvedProfile?.enabledToolNames;
      const cacheKey = ToolPolicyService.buildEnabledSetHash(
        serverIds,
        explicitToolNames ?? []
      );
      const cached = this.chatToolsCache.get(cacheKey);
      if (
        cached &&
        Date.now() - cached.createdAt < AiProvider.CHAT_TOOLS_CACHE_TTL_MS
      ) {
        if (systemTools.length > 0) {
          Logger.info('OPENAI', `使用 ${systemTools.length} 个 System 内置工具（MCP 缓存命中）`);
        }
        return [...systemTools, ...cached.tools];
      }

      const poolKey = resolveMcpPoolKey(resolvedProfile);
      const mcpTools = await this.convertMcpToolsToChatFunctions(
        serverIds.length > 0 ? serverIds : undefined,
        explicitToolNames,
        poolKey,
        chatRequestId
      );
      this.chatToolsCache.set(cacheKey, { tools: mcpTools, createdAt: Date.now() });
      if (systemTools.length > 0) {
        Logger.info('OPENAI', `使用 ${systemTools.length} 个 System 内置工具`);
      }
      return [...systemTools, ...mcpTools];
    } catch (error) {
      Logger.warn('OPENAI', `[${this.providerName}] 获取MCP工具失败: ${error instanceof Error ? error.message : String(error)}`);
      return systemTools;
    }
  }

  /**
   * 创建请求参数对象
   * @param messages 消息历史
   * @param model 模型名称
   * @param temperature 温度参数
   * @param maxTokens 最大生成令牌数
   * @param tools 工具定义列表
   * @param stream 是否流式输出
   * @returns 请求参数对象
   */
  private createRequestParams(
    messages: InternalMessage[],
    model: string,
    temperature: number,
    maxTokens: number,
    tools: ChatTool[] = [],
    stream: boolean = false
  ) {
    logLlmToolsIfEnabled(model, tools);
    const params = {
      model,
      messages: normalizeMessages(messages),
      temperature,
      max_tokens: maxTokens
    };
    
    if (stream) {
      return {
        ...params,
        stream: true,
        stream_options: {
          include_usage: true
        },
        ...(tools.length > 0 ? { tools, tool_choice: 'auto' as const } : {})
      };
    }
    
    return {
      ...params,
      ...(tools.length > 0 ? { tools, tool_choice: 'auto' as const } : {})
    };
  }
  
  /**
   * 处理API响应中的usage信息
   * @param usage API返回的usage信息或null
   * @returns 格式化的UsageInfo对象
   */
  private formatUsage(usage: unknown): UsageInfo {
    if (usage && typeof usage === 'object') {
      const record = usage as Record<string, unknown>;
      return {
        promptTokens: typeof record.prompt_tokens === 'number' ? record.prompt_tokens : 0,
        completionTokens: typeof record.completion_tokens === 'number' ? record.completion_tokens : 0,
        totalTokens: typeof record.total_tokens === 'number' ? record.total_tokens : 0,
      };
    }
    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };
  }

  /**
   * 为 compactHistory 调用 LLM 生成摘要文本
   */
  private async summarizeForCompact(
    serialized: string,
    model: string,
    signal?: AbortSignal
  ): Promise<CompactSummarizeResult> {
    const maxTokens = resolveSummarizeMaxTokens(serialized.length);
    const started = Date.now();
    const response = await this.client.chat.completions.create(
      {
        model,
        messages: [{ role: 'user', content: serialized }],
        max_tokens: maxTokens,
        temperature: 0.3
      },
      { signal }
    );
    const choice = response.choices[0];
    const finishReason = choice?.finish_reason ?? null;
    const content = choice?.message?.content;
    const elapsedMs = Date.now() - started;
    Logger.info(
      'CONTEXT',
      `摘要 LLM 完成 model=${model} max_tokens=${maxTokens} finish_reason=${finishReason ?? '-'} ` +
        `promptChars=${serialized.length} outChars=${typeof content === 'string' ? content.length : 0} ` +
        `llmMs=${elapsedMs}`
    );
    if (typeof content === 'string' && content.length > 0) {
      return { text: content, finishReason };
    }
    return { text: '（摘要生成失败）', finishReason };
  }

  private resolveSummarizeFn(
    enableAutoCompact?: boolean,
    compactModel?: string,
    signal?: AbortSignal
  ): ((messages: InternalMessage[]) => Promise<InternalMessage[]>) | undefined {
    if (!resolveEnableAutoCompact(enableAutoCompact)) {
      return undefined;
    }
    const summarizeModel = resolveCompactModel(compactModel, this.config.defaultModel);
    return this.buildSummarizeFn(summarizeModel, signal);
  }

  private buildSummarizeFn(
    model: string,
    signal?: AbortSignal
  ): (messages: InternalMessage[]) => Promise<InternalMessage[]> {
    return async (messages: InternalMessage[]) => {
      const { compactHistory } = await import('../context-compact.js');
      return compactHistory(messages, async (serialized) =>
        this.summarizeForCompact(serialized, model, signal)
      );
    };
  }

  /**
   * 上下文预览（P1-01-06，无 LLM）
   */
  async previewMainModelContext(
    messages: InternalMessage[],
    options: MainModelContextPreviewOptions
  ): Promise<ContextPreviewResult> {
    const { buildMainModelContextPreview } = await import('../context-compact.js');
    return buildMainModelContextPreview(messages, options);
  }

  /**
   * 手动压缩会话消息（P1-01-05 / P1-01-09）
   */
  async compactMessages(
    messages: InternalMessage[],
    compactModel?: string,
    signal?: AbortSignal
  ): Promise<InternalMessage[]> {
    const { compactHistory } = await import('../context-compact.js');
    const summarizeModel = resolveCompactModel(compactModel, this.config.defaultModel);
    return compactHistory(messages, async (serialized) =>
      this.summarizeForCompact(serialized, summarizeModel, signal)
    );
  }

  /**
   * 构建 Agent Loop 所需的 Provider 适配器
   */
  private getAgentLoopProvider(): AgentLoopProvider {
    return {
      providerName: this.providerName,
      createRequestParams: (...args) => this.createRequestParams(...args),
      createCompletionStream: async (requestParams, signal) => {
        const stream = await this.client.chat.completions.create(
          requestParams as unknown as Parameters<OpenAIClient['chat']['completions']['create']>[0],
          { signal }
        );
        return stream as AsyncIterable<unknown>;
      },
      createCompletion: async (requestParams, signal) => {
        return await this.client.chat.completions.create(
          requestParams as unknown as Parameters<OpenAIClient['chat']['completions']['create']>[0],
          { signal }
        );
      },
      processModelResponse: (...args) => this.processModelResponse(...args),
      processNonStreamResponse: (...args) => this.processNonStreamResponse(...args)
    };
  }

  /**
   * 处理模型的非流式响应
   */
  private async processNonStreamResponse(
    response: unknown,
    round: number,
    toolManager: ToolCallManager,
    fullContent: string,
    fullReasoningContent: string,
    usage: UsageInfo | null,
    finishReasonResult: string | undefined | null,
    onChunk: (chunk: ChunkResponse, done: boolean) => void
  ): Promise<ModelResponseResult> {
    const resp = response as {
      choices?: Array<{
        message?: {
          content?: string | null;
          reasoning_content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason?: string;
      }>;
      usage?: unknown;
    };

    const choice = resp.choices?.[0];
    const message = choice?.message;
    let updatedContent = fullContent;
    let updatedReasoningContent = fullReasoningContent;
    let hasNewToolCalls = false;
    const newToolCalls: ToolCallRecord[] = [];

    const content = message?.content || '';
    const reasoningContent = message?.reasoning_content || '';

    if (content) {
      updatedContent += content;
      onChunk({ content }, false);
    }

    if (reasoningContent) {
      updatedReasoningContent += reasoningContent;
      onChunk({ reasoning_content: reasoningContent }, false);
    }

    const apiToolCalls = message?.tool_calls ?? [];
    if (apiToolCalls.length > 0) {
      hasNewToolCalls = true;

      for (let localIndex = 0; localIndex < apiToolCalls.length; localIndex++) {
        const apiToolCall = apiToolCalls[localIndex];
        if (!apiToolCall?.function) {
          continue;
        }
        let globalIndex: number;

        if (round === 0) {
          globalIndex = await toolManager.createToolCall(
            localIndex,
            apiToolCall.id,
            apiToolCall.function.name
          );
        } else if (!newToolCalls[localIndex]) {
          globalIndex = await toolManager.createToolCall(
            localIndex,
            apiToolCall.id,
            apiToolCall.function.name
          );
          const created = toolManager.getAllToolCalls()[globalIndex];
          if (created) {
            newToolCalls[localIndex] = created;
          }
        } else {
          globalIndex = newToolCalls[localIndex]!.meta?.globalIndex as number;
        }

        toolManager.updateToolArguments(globalIndex, apiToolCall.function.arguments);
      }
    }

    return {
      fullContent: updatedContent,
      fullReasoningContent: updatedReasoningContent,
      usage: resp.usage ? this.formatUsage(resp.usage) : usage,
      finishReasonResult: choice?.finish_reason ?? finishReasonResult,
      hasNewToolCalls,
      newToolCalls: newToolCalls.filter(tc => tc && tc.name)
    };
  }

  /**
   * 处理模型的流式响应
   */
  private async processModelResponse(
    stream: AsyncIterable<unknown>,
    round: number,
    toolManager: ToolCallManager,
    fullContent: string,
    fullReasoningContent: string,
    usage: UsageInfo | null,
    finishReasonResult: string | undefined | null,
    onChunk: (chunk: ChunkResponse, done: boolean) => void
  ): Promise<ModelResponseResult> {
    let hasNewToolCalls = false;
    let newToolCalls: ToolCallRecord[] = [];
    let updatedContent = fullContent;
    let updatedReasoningContent = fullReasoningContent;
    let updatedUsage = usage;
    let updatedFinishReason = finishReasonResult;

    try {
      for await (const chunk of stream) {
        const chunkData = chunk as {
          choices?: Array<{ delta?: ExtendedDelta; finish_reason?: string }>;
          usage?: unknown;
        };
        const delta = chunkData.choices?.[0]?.delta ?? {};
        const content = delta.content || '';
        const reasoningContent = delta.reasoning_content || '';
        const deltaToolCalls = delta.tool_calls || [];
        const finishReason = chunkData.choices?.[0]?.finish_reason;

        if (content) {
          updatedContent += content;
          onChunk({ content }, false);
        }

        if (reasoningContent) {
          updatedReasoningContent += reasoningContent;
          onChunk({ reasoning_content: reasoningContent }, false);
        }

        if (deltaToolCalls.length > 0) {
          hasNewToolCalls = true;

          for (const deltaToolCall of deltaToolCalls) {
            if (deltaToolCall.index !== undefined) {
              const localIndex = deltaToolCall.index;
              let globalIndex: number;

              if (round === 0) {
                const existingToolCalls = toolManager.getAllToolCalls();
                const existingCall = existingToolCalls.find(tc =>
                  tc.meta?.round === 0 && tc.meta?.localIndex === localIndex);

                if (!existingCall) {
                  globalIndex = await toolManager.createToolCall(localIndex, deltaToolCall.id, deltaToolCall.function?.name);
                } else {
                  globalIndex = existingCall.meta?.globalIndex as number;
                }
              } else {
                if (!newToolCalls[localIndex]) {
                  globalIndex = await toolManager.createToolCall(localIndex, deltaToolCall.id, deltaToolCall.function?.name || '');
                  const created = toolManager.getAllToolCalls()[globalIndex];
                  if (created) {
                    newToolCalls[localIndex] = created;
                  }
                } else {
                  globalIndex = newToolCalls[localIndex]!.meta?.globalIndex as number;
                }
              }

              if (deltaToolCall.function?.arguments) {
                toolManager.updateToolArguments(globalIndex, deltaToolCall.function.arguments);
              }
            }
          }
        }

        if (chunkData.usage || finishReason === 'stop') {
          if (chunkData.usage) {
            updatedUsage = this.formatUsage(chunkData.usage);
          }

          if (finishReason === 'stop') {
            updatedFinishReason = finishReason;
          }
        }
      }

      return {
        fullContent: updatedContent,
        fullReasoningContent: updatedReasoningContent,
        usage: updatedUsage,
        finishReasonResult: updatedFinishReason,
        hasNewToolCalls,
        newToolCalls: newToolCalls.filter(tc => tc && tc.name)
      };
    } catch (error) {
      Logger.error('OPENAI', `[${this.providerName}] : 处理模型响应失败: ${error instanceof Error ? error.message : String(error)}`);
      onChunk({ error: `处理模型响应失败: ${error instanceof Error ? error.message : String(error)}` }, false);

      return {
        fullContent: updatedContent,
        fullReasoningContent: updatedReasoningContent,
        usage: updatedUsage,
        finishReasonResult: updatedFinishReason,
        hasNewToolCalls: false,
        newToolCalls: []
      };
    }
  }

  /**
   * 处理流式聊天请求
   */
  async chatStream(
    message: string | InternalMessage[],
    onChunk: (chunk: ChunkResponse, done: boolean) => void,
    model: string = this.config.defaultModel,
    temperature: number = this.chatConfig.defaultTemperature,
    maxTokens: number = this.chatConfig.defaultMaxTokens,
    enableTools: boolean = this.toolsConfig.enableMCPTools,
    enablePrompts: boolean = this.toolsConfig.enablePrompts,
    signal?: AbortSignal,
    maxToolCallRounds: number = ToolsConfig.maxToolCallRounds,
    requestId: string = '',
    enableAutoCompact?: boolean,
    compactModel?: string,
    resolvedProfile?: ResolvedProfile,
    permissionCtx?: AgentPermissionContext
  ): Promise<ChatResponse> {
    try {
      const messages = await this.formatMessages(
        message,
        enableTools,
        enablePrompts,
        resolvedProfile,
        signal,
        requestId
      );
      const memoryContext = resolveMemoryPipelineContext(messages, {
        skipMemory: resolvedProfile?.skipMemory,
        documentSessionId: resolvedProfile?.documentSessionId,
        identityScope: resolvedProfile?.memoryScope
      });
      const chatTools = await this.getToolDefinitions(enableTools, resolvedProfile, requestId);
      const summarizeFn = this.resolveSummarizeFn(enableAutoCompact, compactModel, signal);

      // T4-03：已登录会话才落库 / 回写压缩基线；guest（无 userId/chatSessionId）零改动
      const persistUserId = resolvedProfile?.userId;
      const chatSessionId = resolvedProfile?.chatSessionId;
      const persistContext =
        persistUserId && chatSessionId
          ? { userId: persistUserId, chatSessionId }
          : undefined;

      const { runAgentLoop } = await import('../agent-loop.js');

      return await runAgentLoop({
        messages,
        chatTools,
        model,
        temperature,
        maxTokens,
        maxToolCallRounds,
        stream: true,
        signal,
        requestId,
        summarizeFn,
        onContextCompacted: (summaryContent: string) => {
          onChunk({ contextCompacted: true, summaryContent }, false);
          if (persistContext && summaryContent) {
            const store = getChatStore();
            void store.updateCompactBaseline?.(persistContext.userId, persistContext.chatSessionId, {
              summaryContent,
              compactedAt: new Date().toISOString()
            }).catch((error: unknown) => {
              Logger.error(
                'OPENAI',
                `[${this.providerName}] 压缩基线回写失败 chatSessionId=${persistContext.chatSessionId}:`,
                error
              );
            });
          }
        },
        onChunk,
        provider: this.getAgentLoopProvider(),
        permission: permissionCtx,
        memoryContext,
        ...(persistContext ? { persistContext } : {}),
        ...(resolvedProfile !== undefined
          ? { configUserId: resolveMcpPoolKey(resolvedProfile) }
          : {})
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      Logger.error('OPENAI', `[${this.providerName}] 流式聊天API调用失败:`, error);
      throw new Error(`${this.providerName} API流式错误: ${message}`);
    }
  }
}
