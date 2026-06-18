import { retainConversation } from './ports/memory-port.js';
import { isHindsightMemoryConfigured } from './config/feature-config.js';
import { buildRetainContent } from './memory-pipeline-context.js';
import type { InternalMessage } from './types.js';
import { registerHook } from './hook-runner.js';

function isInternalMessageArray(value: unknown): value is InternalMessage[] {
  return Array.isArray(value);
}

/** P3-02-B：会话结束异步 retain */
export function registerMemoryRetainHook(): void {
  registerHook('SessionEnd', async (payload) => {
    if (payload.skipMemory === true || !isHindsightMemoryConfigured()) {
      return { exit_code: 0, message: '' };
    }

    const bankId = typeof payload.bankId === 'string' ? payload.bankId : '';
    if (!bankId || !isInternalMessageArray(payload.messages)) {
      return { exit_code: 0, message: '' };
    }

    const documentSessionId =
      typeof payload.documentSessionId === 'string' ? payload.documentSessionId : undefined;
    const retainPayload = buildRetainContent(payload.messages, documentSessionId);
    if (!retainPayload.content.trim() || retainPayload.content === '[]') {
      return { exit_code: 0, message: '' };
    }

    const requestId = typeof payload.requestId === 'string' ? payload.requestId : undefined;
    const signal =
      payload.signal instanceof AbortSignal ? payload.signal : undefined;

    await retainConversation(bankId, retainPayload.content, {
      requestId,
      documentSessionId,
      conversationStartedAt: retainPayload.conversationStartedAt,
      signal
    });
    return { exit_code: 0, message: '' };
  });
}
