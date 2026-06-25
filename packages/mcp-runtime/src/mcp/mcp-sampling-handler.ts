import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  CreateMessageRequestSchema,
  type CreateMessageResult,
  type SamplingMessage,
} from '@modelcontextprotocol/sdk/types.js';

import { Logger } from '@meek/agent-core';

const SKELETON_MODEL = 'meek-mcp-skeleton';

function summarizeMessageContent(message: SamplingMessage): string {
  const { content } = message;
  if (typeof content === 'string') {
    return content;
  }
  if (content && typeof content === 'object' && 'type' in content && content.type === 'text') {
    return content.text;
  }
  return JSON.stringify(content);
}

/**
 * 注册 MCP sampling/createMessage 骨架处理器。
 * 返回确定性 mock，便于 probe 或文档流程验证；未接入真实 LLM。
 */
export function attachMcpSamplingHandler(client: Client): void {
  client.setRequestHandler(CreateMessageRequestSchema, async (request) => {
    const messages = request.params.messages;
    const last = messages.length > 0 ? messages[messages.length - 1] : undefined;
    const preview = last ? summarizeMessageContent(last) : '(empty)';

    Logger.info(
      'MCP SAMPLING',
      `sampling/createMessage messages=${messages.length} lastPreview=${preview.slice(0, 120)}`
    );

    const result: CreateMessageResult = {
      role: 'assistant',
      model: SKELETON_MODEL,
      content: {
        type: 'text',
        text: `[sampling skeleton] ${preview}`,
      },
      stopReason: 'endTurn',
    };
    return result;
  });
}
