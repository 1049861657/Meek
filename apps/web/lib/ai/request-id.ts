import { randomUUID } from 'node:crypto';

/** 生成聊天 requestId（对齐 MCP-Client request-id 用途） */
export function generateRequestId(): string {
  return randomUUID();
}
