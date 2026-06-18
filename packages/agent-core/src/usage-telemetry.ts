import type { ChunkResponse, UsageInfo } from './types.js';

export function emptyUsage(): UsageInfo {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

/** 累加多轮 LLM step usage（仅模型 token，不含工具） */
export function addUsage(base: UsageInfo, step: UsageInfo | null | undefined): UsageInfo {
  if (!step) {
    return { ...base };
  }
  return {
    promptTokens: base.promptTokens + step.promptTokens,
    completionTokens: base.completionTokens + step.completionTokens,
    totalTokens: base.totalTokens + step.totalTokens
  };
}

export function hasUsage(usage: UsageInfo | null | undefined): usage is UsageInfo {
  return !!usage && usage.totalTokens > 0;
}

/**
 * 单轮 LLM 调用结束后推送 step_usage（stream 最终 chunk 到达后调用，时序稳定）。
 * 前端用 cumulative 做实时展示，最终 usage 事件仍以 Harness 汇总为准。
 */
export function emitStepUsage(
  onChunk: (chunk: ChunkResponse, done: boolean) => void,
  round: number,
  step: UsageInfo,
  cumulative: UsageInfo
): void {
  if (!hasUsage(step)) {
    return;
  }
  onChunk(
    {
      step_usage: {
        round,
        step: { ...step },
        cumulative: { ...cumulative }
      }
    },
    false
  );
}
