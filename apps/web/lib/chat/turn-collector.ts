/**
 * 单轮 SSE 工具/推理收集 — 对齐 turn-collector.js
 */

import {
  buildToolCallsFromStored,
  stringifyToolContent,
} from './message-history-builder';
import type { HistoryEntry, StoredToolCall } from './storage-contract';

const TRUNCATE_THRESHOLD = 64 * 1024;
const TODO_TOOL_NAME = 'todo';
const TODO_SLOT_KEY = '__todo_slot__';

export type ToolSourceResolver = (name: string) => 'system' | 'mcp';

export interface TurnSnapshot {
  turnId: string;
  reasoning?: string;
  toolCalls?: StoredToolCall[];
}

export class TurnCollector {
  private readonly _resolveToolSource: ToolSourceResolver;
  private _turnId = '';
  private _reasoning = '';
  private readonly _toolCallsMap = new Map<string, StoredToolCall>();
  private readonly _toolCallsOrder: string[] = [];

  constructor(resolveToolSource?: ToolSourceResolver) {
    this._resolveToolSource = resolveToolSource ?? (() => 'mcp');
    this.reset();
  }

  reset(): void {
    this._turnId = crypto.randomUUID();
    this._reasoning = '';
    this._toolCallsMap.clear();
    this._toolCallsOrder.length = 0;
  }

  get turnId(): string {
    return this._turnId;
  }

  onToolCall(toolInfo: {
    id?: string;
    name: string;
    args?: unknown;
    source?: string;
  }): void {
    const { id, name, args, source } = toolInfo;
    if (!id) {
      return;
    }
    if (name === TODO_TOOL_NAME) {
      const existing = this._toolCallsMap.get(TODO_SLOT_KEY);
      if (existing) {
        existing.revision = (existing.revision ?? 1) + 1;
        existing.args = args ?? existing.args;
        existing.lastToolCallId = id;
        return;
      }
      this._toolCallsOrder.push(TODO_SLOT_KEY);
      this._toolCallsMap.set(TODO_SLOT_KEY, {
        id,
        name: TODO_TOOL_NAME,
        source: (source as 'system' | 'mcp') ?? 'system',
        args: args ?? {},
        result: null,
        isError: false,
        progressSteps: [],
        revision: 1,
        lastToolCallId: id,
      });
      return;
    }
    this._toolCallsOrder.push(id);
    this._toolCallsMap.set(id, {
      id,
      name,
      source: (source as 'system' | 'mcp') ?? this._resolveToolSource(name),
      args: args ?? {},
      result: null,
      isError: false,
      progressSteps: [],
    });
  }

  onToolCallUpdate(toolCallId: string, completeArguments: string): void {
    const tc = this._toolCallsMap.get(toolCallId);
    if (!tc || !completeArguments) {
      return;
    }
    try {
      const parsed = JSON.parse(completeArguments) as Record<string, unknown>;
      tc.args = parsed;
      const todo = this._toolCallsMap.get(TODO_SLOT_KEY);
      if (
        todo &&
        (todo.lastToolCallId === toolCallId || todo.id === toolCallId) &&
        Array.isArray(parsed.items)
      ) {
        todo.planningItems = parsed.items.map((item) => ({ ...(item as Record<string, unknown>) }));
      }
    } catch {
      // keep previous args
    }
  }

  onPlanningSnapshot(items: unknown): void {
    const todo = this._toolCallsMap.get(TODO_SLOT_KEY);
    if (!todo || !Array.isArray(items)) {
      return;
    }
    todo.planningItems = items.map((item) => ({ ...(item as Record<string, unknown>) }));
  }

  onToolCallResult(info: {
    tool_call_id: string;
    result: unknown;
    error?: boolean;
    execution_time?: number;
  }): void {
    let tc = this._toolCallsMap.get(info.tool_call_id);
    if (!tc) {
      const todoSlot = this._toolCallsMap.get(TODO_SLOT_KEY);
      if (todoSlot?.lastToolCallId === info.tool_call_id) {
        tc = todoSlot;
      }
    }
    if (!tc) {
      return;
    }
    tc.result = this._maybeTruncate(info.result);
    tc.isError = info.error === true;
    tc.executionTime = info.execution_time;
  }

  onToolProgress(info: {
    index?: number;
    progress?: number;
    total?: number;
    message?: string;
    elapsed_ms?: number;
  }): void {
    const id = this._toolCallsOrder[info.index ?? 0];
    const tc = id ? this._toolCallsMap.get(id) : undefined;
    if (!tc) {
      return;
    }

    const isDone =
      info.total !== undefined && info.progress !== undefined && info.progress >= info.total;
    const toolMatch = info.message?.match(/:\s*(.+)$/);
    const toolsRaw = toolMatch ? toolMatch[1] : (info.message ?? '');
    const tools = toolsRaw
      ? toolsRaw.split(/[,，]\s*/).map((t) => t.trim()).filter(Boolean)
      : [];

    tc.progressSteps = tc.progressSteps ?? [];
    tc.progressSteps.push({
      stepNumber: tc.progressSteps.length + 1,
      tools,
      message: info.message ?? '',
      elapsed_ms: info.elapsed_ms ?? 0,
      isDone,
    });
  }

  onReasoning(text: string): void {
    this._reasoning += text;
  }

  collect(): TurnSnapshot {
    const snapshot: TurnSnapshot = { turnId: this._turnId };

    if (this._reasoning) {
      snapshot.reasoning = this._reasoning;
    }

    const toolCalls = this._toolCallsOrder
      .map((id) => this._toolCallsMap.get(id))
      .filter((tc): tc is StoredToolCall => Boolean(tc));

    if (toolCalls.length > 0) {
      snapshot.toolCalls = toolCalls;
    }

    return snapshot;
  }

  toHistoryEntries(assistantContent: string): HistoryEntry[] {
    const entries: HistoryEntry[] = [];
    const toolCalls = this._toolCallsOrder
      .map((id) => this._toolCallsMap.get(id))
      .filter((tc): tc is StoredToolCall => Boolean(tc));

    const assistant: HistoryEntry = {
      role: 'assistant',
      content: assistantContent ?? '',
      turnId: this._turnId,
    };

    if (this._reasoning) {
      assistant.reasoning_content = this._reasoning;
      assistant.reasoning = this._reasoning;
    }

    if (toolCalls.length > 0) {
      assistant.tool_calls = buildToolCallsFromStored(toolCalls);
      assistant.toolCalls = toolCalls;
      assistant._toolResultsExpanded = true;
      entries.push(assistant);

      for (const tc of toolCalls) {
        if (tc.result === null || tc.result === undefined) {
          continue;
        }
        entries.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: stringifyToolContent(tc.result),
        });
      }
    } else {
      entries.push(assistant);
    }

    return entries;
  }

  private _maybeTruncate(result: unknown): unknown {
    if (result === null || result === undefined) {
      return result;
    }
    const str = typeof result === 'string' ? result : JSON.stringify(result);
    if (str.length <= TRUNCATE_THRESHOLD) {
      return result;
    }
    return {
      _truncated: true,
      preview: str.slice(0, 300),
      originalSize: str.length,
    };
  }
}
