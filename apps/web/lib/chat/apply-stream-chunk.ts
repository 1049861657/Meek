import type { AssistantMessage, ToolCallState } from './chat-ui-types';

function formatArgs(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return String(value ?? '');
  }
}

function findToolCall(
  toolCalls: ToolCallState[],
  index: number,
  toolCallId?: string
): ToolCallState | undefined {
  if (toolCallId) {
    const byId = toolCalls.find((tool) => tool.id === toolCallId);
    if (byId) {
      return byId;
    }
  }
  if (index >= 0 && index < toolCalls.length) {
    return toolCalls[index];
  }
  return toolCalls[toolCalls.length - 1];
}

function upsertToolCall(
  toolCalls: ToolCallState[],
  toolInfo: {
    name: string;
    id?: string;
    args?: unknown;
    source?: 'system' | 'mcp';
  }
): ToolCallState[] {
  const id = toolInfo.id ?? `tool-${toolCalls.length}`;
  const existing = toolCalls.find((tool) => tool.id === id);
  if (existing) {
    return toolCalls;
  }
  return [
    ...toolCalls,
    {
      id,
      name: toolInfo.name || '未命名工具',
      source: toolInfo.source,
      args: formatArgs(toolInfo.args),
      argsComplete: false,
      status: 'running',
    },
  ];
}

function updateToolCall(
  toolCalls: ToolCallState[],
  index: number,
  toolCallId: string | undefined,
  updater: (tool: ToolCallState) => ToolCallState
): ToolCallState[] {
  const target = findToolCall(toolCalls, index, toolCallId);
  if (!target) {
    return toolCalls;
  }
  return toolCalls.map((tool) => (tool.id === target.id ? updater(tool) : tool));
}

/**
 * 将单条 SSE data JSON 应用到 assistant 消息 — 对齐 stream-handler applyStreamDataObject
 */
export function applyStreamChunk(
  message: AssistantMessage,
  jsonData: Record<string, unknown>
): AssistantMessage {
  let next: AssistantMessage = message;

  if (jsonData.type === 'max_tool_calls_reached') {
    const round = typeof jsonData.round === 'number' ? jsonData.round : '?';
    const partialResults = jsonData.partialResults;
    const count = Array.isArray(partialResults) ? partialResults.length : 0;
    const notice = `\n\n[系统: 已达到最大工具调用轮次 ${round}，${count} 个后续工具调用未执行]`;
    next = { ...next, content: next.content + notice };
  }

  if (typeof jsonData.reasoning_content === 'string' && jsonData.reasoning_content.length > 0) {
    next = { ...next, reasoning: jsonData.reasoning_content };
  }

  const toolCall = jsonData.tool_call;
  if (toolCall && typeof toolCall === 'object') {
    const info = toolCall as {
      name?: string;
      id?: string;
      arguments?: unknown;
      source?: 'system' | 'mcp';
    };
    next = {
      ...next,
      toolCalls: upsertToolCall(next.toolCalls, {
        name: info.name ?? '未命名工具',
        id: info.id,
        args: info.arguments,
        source: info.source,
      }),
    };
  }

  const toolCallUpdate = jsonData.tool_call_update;
  if (toolCallUpdate && typeof toolCallUpdate === 'object') {
    const update = toolCallUpdate as {
      index?: number;
      tool_call_id?: string;
      completeArguments?: string;
      arguments?: string;
    };
    const index = update.index ?? 0;
    next = {
      ...next,
      toolCalls: updateToolCall(next.toolCalls, index, update.tool_call_id, (tool) => {
        if (update.completeArguments) {
          try {
            const parsed = JSON.parse(update.completeArguments) as unknown;
            return {
              ...tool,
              args: formatArgs(parsed),
              argsComplete: true,
            };
          } catch {
            return { ...tool, args: update.completeArguments, argsComplete: true };
          }
        }
        if (update.arguments && !tool.argsComplete) {
          let argsStr = update.arguments;
          try {
            argsStr = formatArgs(JSON.parse(update.arguments) as unknown);
          } catch {
            // keep raw fragment
          }
          return { ...tool, args: argsStr };
        }
        return tool;
      }),
    };
  }

  const toolProgress = jsonData.tool_progress;
  if (toolProgress && typeof toolProgress === 'object') {
    const progress = toolProgress as {
      index?: number;
      progress?: number;
      total?: number;
      message?: string;
      elapsed_ms?: number;
    };
    const index = progress.index ?? 0;
    next = {
      ...next,
      toolCalls: updateToolCall(next.toolCalls, index, undefined, (tool) => ({
        ...tool,
        progress: {
          progress: typeof progress.progress === 'number' ? progress.progress : 0,
          ...(typeof progress.total === 'number' ? { total: progress.total } : {}),
          ...(typeof progress.message === 'string' ? { message: progress.message } : {}),
          ...(typeof progress.elapsed_ms === 'number' ? { elapsedMs: progress.elapsed_ms } : {}),
        },
      })),
    };
  }

  const toolCallResult = jsonData.tool_call_result;
  if (toolCallResult && typeof toolCallResult === 'object') {
    const result = toolCallResult as {
      name?: string;
      result?: unknown;
      error?: boolean;
      tool_call_id?: string;
      index?: number;
      execution_time?: number;
      unified?: { status?: string; preview?: string };
    };
    const displayError = result.unified?.status === 'error' || result.error === true;
    const resultStr =
      result.unified?.preview ??
      (result.result == null
        ? ''
        : typeof result.result === 'object'
          ? JSON.stringify(result.result, null, 2)
          : String(result.result));
    const index = result.index ?? -1;
    next = {
      ...next,
      toolCalls: updateToolCall(next.toolCalls, index, result.tool_call_id, (tool) => ({
        ...tool,
        status: displayError ? 'error' : 'success',
        result: resultStr,
        resultError: displayError,
        executionTime:
          typeof result.execution_time === 'number' ? result.execution_time : undefined,
      })),
    };
  }

  const permissionRequest = jsonData.permission_request;
  if (permissionRequest && typeof permissionRequest === 'object') {
    const pr = permissionRequest as {
      tool_call_id: string;
      codeName: string;
      toolName: string;
      argsPreview: string;
      reason: string;
      permissionSessionKey: string;
    };
    next = {
      ...next,
      toolCalls: updateToolCall(next.toolCalls, -1, pr.tool_call_id, (tool) => ({
        ...tool,
        status: 'approval',
        permission: {
          toolCallId: pr.tool_call_id,
          codeName: pr.codeName,
          toolName: pr.toolName,
          argsPreview: pr.argsPreview,
          reason: pr.reason,
          permissionSessionKey: pr.permissionSessionKey,
        },
      })),
    };
  }

  if (typeof jsonData.content === 'string' && jsonData.content.length > 0) {
    next = { ...next, content: next.content + jsonData.content };
  }

  if (typeof jsonData.error === 'string' && jsonData.error.length > 0) {
    next = {
      ...next,
      content: `错误: ${jsonData.error}`,
      isError: true,
      isStreaming: false,
    };
  }

  return next;
}
