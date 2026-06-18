import { createPlanningState } from './planning-state.js';
import {
  ChunkResponse,
  InternalMessage,
  LoopState,
  PartialToolResult,
  ToolCallRecord,
  TransitionReason
} from './types.js';

/** 创建 Agent Loop 显式状态 */
export function createLoopState(messages: InternalMessage[]): LoopState {
  return {
    messages,
    turnCount: 0,
    transitionReason: null,
    planning: createPlanningState()
  };
}

/** 每轮结束后更新续行原因（收尾见 agent_run_audit / llm_step_audit） */
export function recordTurnEnd(
  state: LoopState,
  turn: number,
  reason: TransitionReason
): void {
  state.turnCount = turn;
  state.transitionReason = reason;
}

/** 从工具记录提取触顶时的未完成/中断摘要 */
export function buildPartialResults(toolCalls: ToolCallRecord[]): PartialToolResult[] {
  return toolCalls
    .filter(tc => tc.meta?.status === 'pending' || tc.meta?.status === 'interrupted')
    .map(tc => ({
      id: tc.id,
      name: tc.name,
      codeName: tc.codeName,
      status: tc.meta?.status === 'pending' ? 'pending' : 'interrupted',
      round: tc.meta?.round
    }));
}

/** 推送顶层 SSE 事件 type: max_tool_calls_reached */
export function emitMaxToolCallsReached(
  onChunk: (chunk: ChunkResponse, done: boolean) => void,
  round: number,
  partialResults: PartialToolResult[]
): void {
  onChunk({
    type: 'max_tool_calls_reached',
    round,
    partialResults
  }, false);
}
