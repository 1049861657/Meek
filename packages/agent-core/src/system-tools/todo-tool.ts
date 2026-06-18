import {
  applyTodoUpdate,
  formatTodoToolResult,
  type PlanningState
} from '../planning-state.js';
import type { SystemToolContext } from './system-tool-registry.js';

export const todoToolSchema = {
  type: 'object',
  properties: {
    merge: {
      type: 'boolean',
      description: 'true：按 id 合并更新；false：整表替换'
    },
    items: {
      type: 'array',
      description: 'Todo 条目',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '稳定 id' },
          content: { type: 'string', description: '任务描述' },
          status: {
            type: 'string',
            enum: ['pending', 'in_progress', 'completed']
          },
          activeForm: {
            type: 'string',
            description: '进行中时的进行时描述（可选）'
          }
        },
        required: ['id', 'content', 'status']
      }
    }
  },
  required: ['merge', 'items']
};

function requirePlanning(ctx: SystemToolContext): PlanningState {
  if (!ctx.planning) {
    throw new Error('Todo 工具需要会话规划上下文');
  }
  return ctx.planning;
}

export function executeTodoTool(
  args: Record<string, unknown>,
  ctx: SystemToolContext
): string {
  if (typeof args.merge !== 'boolean') {
    throw new Error('merge 须为 boolean');
  }

  const planning = requirePlanning(ctx);
  planning.items = applyTodoUpdate(planning.items, args.merge, args.items);
  planning.roundsSinceUpdate = 0;
  ctx.onPlanningUpdated?.(planning.items);
  return formatTodoToolResult(planning.items);
}
