/**
 * SSE data 行解析 — 移植自 MCP-Client frontend/src/chat/sse-parse.js
 */

export function parseSseDataPayload(raw: string): Record<string, unknown>[] | null {
  const trimmed = String(raw).trim();
  if (!trimmed) {
    return [];
  }
  if (!/\}\s*\{/.test(trimmed)) {
    try {
      return [JSON.parse(trimmed) as Record<string, unknown>];
    } catch {
      return null;
    }
  }
  const parts = trimmed.split(/\}\s*\{/);
  const out: Record<string, unknown>[] = [];
  try {
    out.push(JSON.parse(`${parts[0]}}`) as Record<string, unknown>);
    for (let k = 1; k < parts.length - 1; k++) {
      out.push(JSON.parse(`{${parts[k]}}`) as Record<string, unknown>);
    }
    out.push(JSON.parse(`{${parts[parts.length - 1]}}`) as Record<string, unknown>);
  } catch {
    return null;
  }
  return out;
}
