import { ToolCallRecord } from './types.js';

/** 单工具执行器：由 agent-loop 注入，参数齐即可被调度 */
export type StreamingToolExecuteFn = (
  toolCall: ToolCallRecord
) => Promise<{ tool_call_id: string; content: string }>;

/**
 * 流式 tool 调度：arguments JSON 凑齐即 execute，不等待 LLM stream 结束。
 * 对齐 Claude StreamingToolExecutor / Vercel onToolCallStart 语义。
 */
export class StreamingToolScheduler {
  private executor: StreamingToolExecuteFn | null = null;
  private readonly scheduledIndices = new Set<number>();
  private readonly executionPromises = new Map<number, Promise<void>>();

  attachExecutor(executor: StreamingToolExecuteFn | null): void {
    this.executor = executor;
  }

  /** arguments 解析完成时尝试调度（幂等） */
  trySchedule(toolCall: ToolCallRecord): void {
    if (!this.executor) {
      return;
    }

    const globalIndex = toolCall.meta?.globalIndex;
    if (globalIndex === undefined) {
      return;
    }

    if (this.scheduledIndices.has(globalIndex)) {
      return;
    }

    if (toolCall.meta?.status !== 'pending') {
      return;
    }

    if (!this.hasCompleteArguments(toolCall)) {
      return;
    }

    this.scheduledIndices.add(globalIndex);
    if (toolCall.meta) {
      toolCall.meta.status = 'executing';
    }

    const promise = this.executor(toolCall).then(() => undefined);

    this.executionPromises.set(globalIndex, promise);
  }

  async awaitExecution(globalIndex: number): Promise<void> {
    const promise = this.executionPromises.get(globalIndex);
    if (promise) {
      await promise;
    }
  }

  async awaitAll(globalIndices: number[]): Promise<void> {
    await Promise.all(globalIndices.map(index => this.awaitExecution(index)));
  }

  private hasCompleteArguments(toolCall: ToolCallRecord): boolean {
    const text = toolCall.argumentsText?.trim() ?? '';
    if (!text) {
      return false;
    }

    const isStructureComplete =
      (text.startsWith('{') && text.endsWith('}')) ||
      (text.startsWith('[') && text.endsWith(']'));

    if (!isStructureComplete) {
      return false;
    }

    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }
}
