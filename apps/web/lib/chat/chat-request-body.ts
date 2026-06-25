/**
 * Web Chat HTTP 请求体 — 对齐 MCP-Client frontend/src/chat/chat-request-body.js
 */

import type { ApiMessage } from './message-history-builder';
import type { PermissionMode } from './storage-contract';

export type { PermissionMode };

export interface BuildChatStreamRequestInput {
  message: string;
  messages?: ApiMessage[];
  model?: string;
  temperature: number;
  maxTokens: number;
  vendor?: string;
  enableTools: boolean;
  enablePrompts: boolean;
  maxToolCallRounds: number;
  permissionMode?: PermissionMode;
  sessionId: string;
  enableAutoCompact: boolean;
  compactModel?: string;
  mcpServerIds?: string[];
  enabledSystemToolNames?: string[];
  skipMemory?: boolean;
  contextOptions?: { messageHistoryCount?: number };
}

export function buildChatStreamRequestBody(
  input: BuildChatStreamRequestInput
): Record<string, unknown> {
  const {
    message,
    messages,
    model,
    temperature,
    maxTokens,
    vendor,
    enableTools,
    enablePrompts,
    maxToolCallRounds,
    enableAutoCompact,
    compactModel,
    mcpServerIds,
    enabledSystemToolNames,
    permissionMode,
    skipMemory,
    sessionId,
    contextOptions,
  } = input;

  const body: Record<string, unknown> = {
    message,
    temperature,
    maxTokens,
    enableTools,
    enablePrompts,
    maxToolCallRounds,
    enableAutoCompact,
  };

  if (typeof model === 'string' && model.trim()) {
    body.model = model.trim();
  }
  if (typeof vendor === 'string' && vendor.trim()) {
    body.vendor = vendor.trim();
  }
  if (typeof compactModel === 'string' && compactModel.trim()) {
    body.compactModel = compactModel.trim();
  }

  if (
    permissionMode === 'open' ||
    permissionMode === 'interactive' ||
    permissionMode === 'locked'
  ) {
    body.permissionMode = permissionMode;
  }

  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    throw new Error('缺少 sessionId');
  }
  body.sessionId = sessionId.trim();

  if (enableTools) {
    body.mcpServerIds = Array.isArray(mcpServerIds) ? mcpServerIds : [];
  }

  if (Array.isArray(enabledSystemToolNames)) {
    body.enabledSystemToolNames = enabledSystemToolNames;
  }

  if (skipMemory === true) {
    body.skipMemory = true;
  }

  if (Array.isArray(messages) && messages.length > 0) {
    body.messages = messages;
  }

  if (contextOptions && typeof contextOptions.messageHistoryCount === 'number') {
    body.contextOptions = { messageHistoryCount: contextOptions.messageHistoryCount };
  }

  return body;
}
