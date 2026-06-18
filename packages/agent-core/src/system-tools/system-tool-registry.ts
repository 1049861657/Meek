import type { PlanningState, TodoItem } from '../planning-state.js';
import { TODO_TOOL_CODE_NAME } from '../planning-state.js';
import { ChatTool } from '../types.js';
import {
  executeReadPersistedOutput,
  READ_PERSISTED_OUTPUT_CODE_NAME,
  readPersistedOutputSchema
} from './read-persisted-output.js';
import { executeTodoTool, todoToolSchema } from './todo-tool.js';

export interface SystemToolContext {
  signal?: AbortSignal;
  planning?: PlanningState;
  onPlanningUpdated?: (items: TodoItem[]) => void;
}

type SystemToolExecutor = (
  args: Record<string, unknown>,
  ctx: SystemToolContext
) => Promise<string>;

export interface SystemToolDescriptor {
  codeName: string;
  label: string;
  /** 设置弹窗展示；技术说明见 description */
  summary: string;
  description: string;
}

interface SystemToolEntry extends SystemToolDescriptor {
  parameters: ChatTool['function']['parameters'];
  execute: SystemToolExecutor;
}

const REGISTRY: SystemToolEntry[] = [
  {
    codeName: READ_PERSISTED_OUTPUT_CODE_NAME,
    label: '读取落盘输出',
    summary: '工具结果过长时，分段读回完整内容。',
    description:
      '读取 agentOutputs 落盘文件。仅当 tool 结果为 type=tool_output_artifact 且需全文或更多行时调用。' +
      'path 为 toolCallId；大文件用 offset/limit（1-based 行号）分页。',
    parameters: readPersistedOutputSchema,
    execute: (args, _ctx) => executeReadPersistedOutput(args)
  },
  {
    codeName: TODO_TOOL_CODE_NAME,
    label: '任务计划',
    summary: '多步任务拆解为清单，并在聊天中展示进度。',
    description:
      '维护本会话任务计划。复杂多步 MCP 工作流前先建计划；merge=true 按 id 更新，merge=false 整表替换。' +
      'status: pending | in_progress | completed；至多 1 个 in_progress。',
    parameters: todoToolSchema,
    execute: async (args, ctx) => executeTodoTool(args, ctx)
  }
];

const REGISTRY_BY_NAME = new Map(REGISTRY.map(entry => [entry.codeName, entry]));

export function isSystemTool(codeName: string): boolean {
  return REGISTRY_BY_NAME.has(codeName);
}

export function listSystemToolDescriptors(): SystemToolDescriptor[] {
  return REGISTRY.map(({ codeName, label, summary, description }) => ({
    codeName,
    label,
    summary,
    description
  }));
}

export function getDefaultEnabledSystemToolNames(): string[] {
  return REGISTRY.map(tool => tool.codeName);
}

export function sanitizeEnabledSystemToolNames(names: readonly string[]): string[] {
  const known = new Set(REGISTRY.map(tool => tool.codeName));
  return names.filter(name => known.has(name));
}

/** 转为 OpenAI tools[]；未传 enabledNames 时默认全部启用 */
export function getSystemToolSchemas(enabledNames?: readonly string[]): ChatTool[] {
  const allowed =
    enabledNames === undefined
      ? new Set(REGISTRY.map(tool => tool.codeName))
      : new Set(sanitizeEnabledSystemToolNames(enabledNames));
  return REGISTRY.filter(tool => allowed.has(tool.codeName)).map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.codeName,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
}

export async function executeSystemTool(
  codeName: string,
  args: Record<string, unknown>,
  ctx: SystemToolContext = {}
): Promise<string> {
  const entry = REGISTRY_BY_NAME.get(codeName);
  if (!entry) {
    throw new Error(`未注册的 System 工具: ${codeName}`);
  }

  return entry.execute(args, ctx);
}
