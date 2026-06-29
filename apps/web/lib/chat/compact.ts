import { Logger } from '@meek/agent-core';
import { getProviderForUser, type InternalMessage } from '@meek/agent-core/provider';

import { loadAiProvidersConfig } from '@/lib/ai/provider-config';
import { generateRequestId } from '@/lib/ai/request-id';

export interface CompactChatBody {
  messages?: unknown;
  vendor?: unknown;
  compactModel?: unknown;
}

export interface CompactChatSuccess {
  success: true;
  requestId: string;
  elapsedMs: number;
  messages: InternalMessage[];
}

export interface CompactChatFailure {
  error: string;
}

export type CompactChatResponse = CompactChatSuccess | CompactChatFailure;

export interface CompactChatHttpResult {
  status: number;
  body: CompactChatResponse;
}

function isInternalMessageArray(value: unknown): value is InternalMessage[] {
  return Array.isArray(value);
}

function countInputChars(messages: InternalMessage[]): number {
  return messages.reduce((sum, message) => {
    const content = message.content;
    return sum + (typeof content === 'string' ? content.length : 0);
  }, 0);
}

/**
 * 手动压缩会话消息历史（对齐 MCP-Client ai.controller.compact）
 */
export async function handleCompactChat(
  body: CompactChatBody,
  configUserId: string | null = null
): Promise<CompactChatHttpResult> {
  if (!isInternalMessageArray(body.messages) || body.messages.length === 0) {
    return {
      status: 400,
      body: { error: '缺少 messages 参数或消息为空' },
    };
  }

  const messages = [...body.messages];
  const vendor = typeof body.vendor === 'string' ? body.vendor : undefined;
  const compactModel = typeof body.compactModel === 'string' ? body.compactModel : undefined;

  await loadAiProvidersConfig(configUserId);
  const service = await getProviderForUser(configUserId, vendor);
  if (!service) {
    return {
      status: 500,
      body: { error: '无法获取 AI 服务' },
    };
  }

  const requestId = generateRequestId();
  const inputChars = countInputChars(messages);
  const wallStarted = Date.now();
  Logger.info(
    'API',
    `收到压缩请求 requestId=${requestId} messages=${messages.length} inputChars=${inputChars} ` +
      `vendor=${vendor ?? '默认'} compactModel=${compactModel ?? '(默认)'}`
  );

  const compacted = await service.compactMessages(messages, compactModel);
  const elapsedMs = Date.now() - wallStarted;
  Logger.info('API', `压缩完成 requestId=${requestId} elapsedMs=${elapsedMs}`);

  return {
    status: 200,
    body: {
      success: true,
      requestId,
      elapsedMs,
      messages: compacted,
    },
  };
}
