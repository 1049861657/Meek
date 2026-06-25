/**
 * SSE payload → TurnCollector 同步 — 对齐 stream-handler applyStreamDataObject
 */

import type { TurnCollector } from './turn-collector';

export function feedTurnCollectorFromPayload(
  collector: TurnCollector | null | undefined,
  jsonData: Record<string, unknown>
): void {
  if (!collector) {
    return;
  }

  if (typeof jsonData.reasoning_content === 'string' && jsonData.reasoning_content.length > 0) {
    collector.onReasoning(jsonData.reasoning_content);
  }

  const toolCall = jsonData.tool_call;
  if (toolCall && typeof toolCall === 'object') {
    const info = toolCall as {
      name?: string;
      id?: string;
      arguments?: unknown;
      source?: string;
    };
    collector.onToolCall({
      id: info.id,
      name: info.name ?? '未命名工具',
      args: info.arguments,
      source: info.source,
    });
  }

  const toolCallUpdate = jsonData.tool_call_update;
  if (toolCallUpdate && typeof toolCallUpdate === 'object') {
    const update = toolCallUpdate as { tool_call_id?: string; completeArguments?: string };
    if (update.tool_call_id && update.completeArguments) {
      collector.onToolCallUpdate(update.tool_call_id, update.completeArguments);
    }
  }

  const toolProgress = jsonData.tool_progress;
  if (toolProgress && typeof toolProgress === 'object') {
    collector.onToolProgress(
      toolProgress as {
        index?: number;
        progress?: number;
        total?: number;
        message?: string;
        elapsed_ms?: number;
      }
    );
  }

  const toolCallResult = jsonData.tool_call_result;
  if (toolCallResult && typeof toolCallResult === 'object') {
    const result = toolCallResult as {
      tool_call_id: string;
      result: unknown;
      error?: boolean;
      execution_time?: number;
    };
    collector.onToolCallResult(result);
  }

  const planningUpdate = jsonData.planning_update;
  if (planningUpdate && typeof planningUpdate === 'object') {
    const items = (planningUpdate as { items?: unknown[] }).items;
    collector.onPlanningSnapshot(items);
  }
}
