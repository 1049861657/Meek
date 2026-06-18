import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

import { ContextConfig } from '../config/feature-config.js';
import { resolveAgentOutputsDir, resolveUnderDir } from './path-safety.js';

export const READ_PERSISTED_OUTPUT_CODE_NAME = 'read_persisted_output';

export interface ReadPersistedOutputArgs {
  path: string;
  offset?: number;
  limit?: number;
}

function parseLineRangeArgs(args: Record<string, unknown>): { offset?: number; limit?: number } {
  let offset: number | undefined;
  let limit: number | undefined;

  if (args.offset !== undefined && args.offset !== null) {
    if (typeof args.offset !== 'number' || !Number.isFinite(args.offset) || args.offset < 1) {
      throw new Error('offset 须为 >= 1 的整数');
    }
    offset = Math.floor(args.offset);
  }

  if (args.limit !== undefined && args.limit !== null) {
    if (typeof args.limit !== 'number' || !Number.isFinite(args.limit) || args.limit < 1) {
      throw new Error('limit 须为 >= 1 的整数');
    }
    limit = Math.floor(args.limit);
  }

  return { offset, limit };
}

function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }
  return content.split('\n').length;
}

/** 按 1-based 行号截取内容 */
export function applyLineRange(content: string, offset?: number, limit?: number): string {
  if (offset === undefined && limit === undefined) {
    return content;
  }

  const lines = content.split('\n');
  const startIdx = offset !== undefined ? offset - 1 : 0;
  if (startIdx < 0 || startIdx >= lines.length) {
    return '';
  }

  const endIdx = limit !== undefined ? startIdx + limit : lines.length;
  return lines.slice(startIdx, endIdx).join('\n');
}

function formatLineRangeHeader(
  filePath: string,
  startLine: number,
  endLine: number,
  totalLines: number
): string {
  return `[read_persisted_output] ${filePath}\nlines ${startLine}-${endLine} of ${totalLines}\n\n`;
}

/** 分页结果仍超预算时拒绝，避免再次触发落盘 */
function assertSliceWithinBudget(sliced: string, offset?: number, limit?: number): void {
  if (sliced.length <= ContextConfig.persistThresholdChars) {
    return;
  }
  throw new Error(
    `读取片段过大（${sliced.length} 字符，上限 ${ContextConfig.persistThresholdChars}）。` +
      `请减小 limit（当前 offset=${offset ?? 1}, limit=${limit ?? '未指定'}）。`
  );
}

function buildPartialView(content: string, filePath: string): string {
  const totalLines = countLines(content);
  const defaultLines = ContextConfig.readPartialDefaultLines;
  const endLine = Math.min(defaultLines, totalLines);
  let preview = applyLineRange(content, 1, defaultLines);

  if (preview.length > ContextConfig.persistPreviewChars) {
    preview = preview.slice(0, ContextConfig.persistPreviewChars);
  }

  return (
    `[read_persisted_output] PARTIAL ${filePath}\n` +
    `全文 ${content.length} 字符、${totalLines} 行；以下为第 1-${endLine} 行预览。` +
    `续读请传 offset/limit。\n\n` +
    preview
  );
}

export async function executeReadPersistedOutput(args: Record<string, unknown>): Promise<string> {
  const pathArg = args.path;
  if (typeof pathArg !== 'string' || !pathArg.trim()) {
    throw new Error('path 为必填字符串（tool_call_id、文件名或 agentOutputs 内相对路径）');
  }

  const { offset, limit } = parseLineRangeArgs(args);
  const outputsDir = resolveAgentOutputsDir(process.cwd(), ContextConfig.agentOutputsDir);
  const filePath = resolveUnderDir(outputsDir, pathArg.trim());

  try {
    await access(filePath, constants.R_OK);
  } catch {
    throw new Error(`文件不存在或不可读: ${filePath}`);
  }

  const content = await readFile(filePath, 'utf8');
  const totalLines = countLines(content);

  if (offset === undefined && limit === undefined) {
    if (content.length > ContextConfig.persistThresholdChars) {
      return buildPartialView(content, filePath);
    }
    return `[read_persisted_output] ${filePath}\n\n${content}`;
  }

  const sliced = applyLineRange(content, offset, limit);
  assertSliceWithinBudget(sliced, offset, limit);

  const startLine = offset ?? 1;
  const endLine =
    limit !== undefined
      ? Math.min(startLine + limit - 1, totalLines)
      : totalLines;

  return formatLineRangeHeader(filePath, startLine, endLine, totalLines) + sliced;
}

export const readPersistedOutputSchema = {
  type: 'object' as const,
  properties: {
    path: {
      type: 'string',
      description:
        'tool_call_id、.txt 文件名，或 .agent-outputs/ 内相对路径；也可为 persist 消息中的绝对路径（须在 agentOutputsDir 内）'
    },
    offset: {
      type: 'number',
      description: '起始行号（1-based）；大文件必填或配合 limit 分页'
    },
    limit: {
      type: 'number',
      description: '最多读取行数；单片段须小于落盘阈值（默认 30000 字符）'
    }
  },
  required: ['path'] as string[]
};
