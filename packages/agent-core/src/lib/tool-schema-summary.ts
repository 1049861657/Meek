import type { ToolInfo } from '../mcp-types.js';

const MAX_DESC_LEN = 96;

function truncate(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLen - 1)}…`;
}

function formatParams(tool: ToolInfo): string {
  if (!tool.parameters.length) {
    return '';
  }
  return tool.parameters
    .map((p) => `${p.name}${p.required ? '' : '?'}:${p.type}`)
    .join(', ');
}

export function formatToolSchemaSummaryLine(tool: ToolInfo): string {
  const params = formatParams(tool);
  const head = params ? `${tool.name}(${params})` : tool.name;
  const desc = truncate(tool.description, MAX_DESC_LEN);
  return `- ${head}: ${desc}`;
}

export function buildEnabledToolsSchemaSummary(tools: ToolInfo[]): string {
  if (tools.length === 0) {
    return '';
  }
  const lines = tools.map(formatToolSchemaSummaryLine);
  return (
    '### 启用工具（摘要）\n' +
    '以下为本轮唯一可调用工具；用户提示词中若提及其他工具名，不得调用。\n' +
    lines.join('\n')
  );
}
