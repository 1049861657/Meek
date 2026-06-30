import {
  getProviderForUser,
  initializeProviders,
  resolveEnableAutoCompact,
  type InternalMessage,
} from '@meek/agent-core';

import { syncAiProvidersConfigPort } from '@/lib/ai/provider-config';
import { loadMcpConfig } from '@/lib/mcp/mcp-config';
import { assembleContextMessages } from '@/lib/chat/chat-store-stub';
import type { RequestPrincipal } from '@/lib/chat/resolve-principal';

export interface ContextPreviewBody {
  messages?: unknown;
  enableAutoCompact?: unknown;
  contextOverride?: unknown;
  vendor?: unknown;
  sessionId?: unknown;
  contextOptions?: { messageHistoryCount?: unknown };
}

export interface ContextPreviewSuccess {
  success: true;
  preview: unknown;
}

export interface ContextPreviewFailure {
  error: string;
}

export type ContextPreviewResponse = ContextPreviewSuccess | ContextPreviewFailure;

export interface ContextPreviewHttpResult {
  status: number;
  body: ContextPreviewResponse;
}

function isInternalMessageArray(value: unknown): value is InternalMessage[] {
  return Array.isArray(value);
}

async function resolveContextMessages(
  body: ContextPreviewBody,
  principal: RequestPrincipal,
  bodyMessages: InternalMessage[]
): Promise<InternalMessage[] | null> {
  const sessionId =
    typeof body.sessionId === 'string' ? body.sessionId.trim() : '';
  if (!principal.userId || !sessionId) {
    return bodyMessages;
  }
  const messageHistoryCount =
    typeof body.contextOptions?.messageHistoryCount === 'number' &&
    body.contextOptions.messageHistoryCount > 0
      ? body.contextOptions.messageHistoryCount
      : undefined;
  return assembleContextMessages(principal.userId, sessionId, { messageHistoryCount });
}

export async function handleContextPreview(
  body: ContextPreviewBody,
  principal: RequestPrincipal
): Promise<ContextPreviewHttpResult> {
  const bodyMessages = isInternalMessageArray(body.messages) ? body.messages : [];
  const messages = await resolveContextMessages(body, principal, bodyMessages);
  if (!messages) {
    return { status: 400, body: { error: 'messages 必须为数组' } };
  }

  const vendor = typeof body.vendor === 'string' ? body.vendor : undefined;
  await loadMcpConfig(principal.configUserId);
  await syncAiProvidersConfigPort(principal.configUserId);
  await initializeProviders();
  const service = await getProviderForUser(principal.configUserId, vendor);
  if (!service) {
    return { status: 500, body: { error: '无法获取 AI 服务' } };
  }

  const contextOverride = isInternalMessageArray(body.contextOverride)
    ? body.contextOverride
    : null;

  const preview = service.previewMainModelContext(messages, {
    enableAutoCompact: resolveEnableAutoCompact(
      typeof body.enableAutoCompact === 'boolean' ? body.enableAutoCompact : undefined
    ),
    contextOverride: contextOverride && contextOverride.length > 0 ? contextOverride : null,
  });

  return { status: 200, body: { success: true, preview } };
}
