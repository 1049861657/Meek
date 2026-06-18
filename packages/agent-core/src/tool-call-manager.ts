import { ToolNameCodec } from './lib/tool-name-codec.js';
import { isSystemTool } from './system-tools/system-tool-registry.js';
import { StreamingToolExecuteFn, StreamingToolScheduler } from './streaming-tool-scheduler.js';
import type { UnifiedToolResult } from './mcp-types.js';
import { ChunkResponse, ToolCallRecord, ToolOutputArtifact } from './types.js';

function resolveToolCallSource(codeName: string): 'system' | 'mcp' {
  return isSystemTool(codeName) ? 'system' : 'mcp';
}

/**
 * 工具调用管理器 - 负责工具调用的生命周期管理与 SSE 事件推送
 */
export class ToolCallManager {
  private toolCalls: ToolCallRecord[] = [];
  private indexMap: Map<number, ToolCallRecord> = new Map();
  private currentRound = 0;
  private providerName: string;
  private onChunk: (chunk: ChunkResponse, done: boolean) => void;
  private reachedMaxRounds = false;
  private readonly streamingScheduler = new StreamingToolScheduler();

  constructor(providerName: string, onChunk: (chunk: ChunkResponse, done: boolean) => void) {
    this.providerName = providerName;
    this.onChunk = onChunk;
  }

  attachStreamingExecutor(executor: StreamingToolExecuteFn | null): void {
    this.streamingScheduler.attachExecutor(executor);
  }

  getToolCall(globalIndex: number): ToolCallRecord | undefined {
    return this.indexMap.get(globalIndex);
  }

  async awaitToolExecution(globalIndex: number): Promise<void> {
    await this.streamingScheduler.awaitExecution(globalIndex);
  }

  async awaitToolExecutions(globalIndices: number[]): Promise<void> {
    await this.streamingScheduler.awaitAll(globalIndices);
  }

  markExecutionStart(globalIndex: number): void {
    const toolCall = this.indexMap.get(globalIndex);
    if (toolCall?.meta) {
      toolCall.meta.executionStartedAt = new Date().toISOString();
    }
  }

  setReachedMaxRounds(reached: boolean): void {
    this.reachedMaxRounds = reached;
  }

  hasReachedMaxRounds(): boolean {
    return this.reachedMaxRounds;
  }

  async createToolCall(index: number, id?: string, name: string = ''): Promise<number> {
    const toolCallId = id || `tool-call-round-${this.currentRound}-${Date.now()}-${index}`;
    const globalIndex = this.toolCalls.length;

    const source = resolveToolCallSource(name);
    const toolCall: ToolCallRecord = {
      id: toolCallId,
      codeName: name,
      name: name.startsWith('mcp__') ? ToolNameCodec.decode(name) : name,
      arguments: {},
      meta: {
        round: this.currentRound,
        localIndex: index,
        globalIndex,
        source,
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    };

    this.toolCalls.push(toolCall);
    this.indexMap.set(globalIndex, toolCall);

    this.onChunk({
      tool_call: {
        index: globalIndex,
        id: toolCallId,
        name: toolCall.name,
        source
      }
    }, false);

    return globalIndex;
  }

  updateToolArguments(globalIndex: number, argumentText: string): void {
    const toolCall = this.indexMap.get(globalIndex);
    if (!toolCall) return;

    if (!toolCall.argumentsText) {
      toolCall.argumentsText = '';
    }
    toolCall.argumentsText += argumentText;

    const parsedArgs = this.tryParseJson(toolCall.argumentsText);
    if (parsedArgs !== null) {
      toolCall.arguments = parsedArgs;
      this.onChunk({
        tool_call_update: {
          index: globalIndex,
          completeArguments: JSON.stringify(parsedArgs),
          tool_call_id: toolCall.id
        }
      }, false);
      this.streamingScheduler.trySchedule(toolCall);
    }
  }

  private tryParseJson(text: string): Record<string, unknown> | null {
    if (!text) return null;

    const trimmed = text.trim();
    const isStructureComplete =
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'));

    if (!isStructureComplete) return null;

    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  setToolResult(
    globalIndex: number,
    result: unknown,
    error: boolean = false,
    errorMessage?: string,
    executionTimeMs?: number,
    artifact?: ToolOutputArtifact,
    unified?: UnifiedToolResult
  ): void {
    const toolCall = this.indexMap.get(globalIndex);
    if (!toolCall) return;

    toolCall.result = result;
    if (artifact && toolCall.meta) {
      toolCall.meta.artifact = artifact;
    }

    if (toolCall.meta) {
      toolCall.meta.status = error ? 'error' : 'completed';
      toolCall.meta.completedAt = new Date().toISOString();
      if (error && errorMessage) {
        toolCall.meta.errorMessage = errorMessage;
      }

      if (executionTimeMs !== undefined) {
        toolCall.meta.executionTime = executionTimeMs;
      } else if (toolCall.meta.executionStartedAt) {
        const startTime = new Date(toolCall.meta.executionStartedAt).getTime();
        const endTime = new Date(toolCall.meta.completedAt).getTime();
        toolCall.meta.executionTime = endTime - startTime;
      } else if (toolCall.meta.createdAt) {
        const startTime = new Date(toolCall.meta.createdAt).getTime();
        const endTime = new Date(toolCall.meta.completedAt).getTime();
        toolCall.meta.executionTime = endTime - startTime;
      }

    }

    this.onChunk({
      tool_call_result: {
        name: toolCall.name,
        result,
        error,
        index: globalIndex,
        tool_call_id: toolCall.id,
        execution_time: toolCall.meta?.executionTime,
        artifact,
        unified
      }
    }, false);
  }

  setToolProgress(
    globalIndex: number,
    progress: number,
    total: number | undefined,
    message: string | undefined,
    elapsed_ms?: number
  ): void {
    this.onChunk({
      tool_progress: {
        index: globalIndex,
        progress,
        total,
        message,
        elapsed_ms
      }
    }, false);
  }

  getToolCallsByRound(round: number): ToolCallRecord[] {
    return this.toolCalls.filter(tc => tc.meta && tc.meta.round === round);
  }

  getTotalCount(): number {
    return this.toolCalls.length;
  }

  getCurrentRound(): number {
    return this.currentRound;
  }

  setCurrentRound(round: number): void {
    this.currentRound = round;
  }

  getAllToolCalls(): ToolCallRecord[] {
    return [...this.toolCalls];
  }

  finalizeAllToolCalls(): void {
    let pendingFound = false;

    this.toolCalls.forEach((tc) => {
      if (tc.meta && (tc.meta.status === 'pending' || tc.meta.status === 'executing')) {
        pendingFound = true;
        tc.meta.status = 'interrupted';
        tc.meta.completedAt = new Date().toISOString();

        if (this.reachedMaxRounds) {
          tc.meta.interruptReason = '已达到最大工具调用次数限制';
        } else {
          tc.meta.interruptReason = '工具调用处理过程被中断';
        }

        let executionTime: number | undefined;
        if (tc.meta.createdAt) {
          const startTime = new Date(tc.meta.createdAt).getTime();
          const endTime = new Date(tc.meta.completedAt).getTime();
          executionTime = endTime - startTime;
          tc.meta.executionTime = executionTime;
        }

        const globalIndex = tc.meta.globalIndex ?? 0;
        const resultMessage = {
          status: 'interrupted',
          message: this.reachedMaxRounds
            ? '已达到最大工具调用次数限制'
            : '工具调用处理过程被中断',
          details: this.reachedMaxRounds
            ? `系统限制了最大连续工具调用次数为${this.currentRound}次，为保证系统稳定性，后续工具调用已被中断`
            : '请求处理结束，工具调用未能完成'
        };

        this.onChunk({
          tool_call_result: {
            name: tc.name,
            result: resultMessage,
            index: globalIndex,
            tool_call_id: tc.id,
            error: true,
            execution_time: executionTime
          }
        }, false);
      }
    });

  }

  hasValidToolCalls(): boolean {
    return this.toolCalls.some(tc => tc && tc.name);
  }
}
