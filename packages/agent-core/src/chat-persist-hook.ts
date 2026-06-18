import { getChatStore } from './ports/chat-store-port.js';
import { Logger } from './lib/logger.js';
import { registerHook } from './hook-runner.js';
import type { InternalMessage } from './types.js';

/**
 * T4-03-04：已登录会话轮末落库（SessionEnd，与 memory-retain 并列）。
 * 仅当 payload 带 userId + chatSessionId（authed）时执行；guest 跳过。
 * 与 HTTP 生命周期解耦：abort 时本 hook 仍在 agent-loop 的 finally 中执行，
 * 已产出轮次照常落库（ChatStore 内部不使用 abort signal）。
 */
export function registerChatPersistHook(): void {
  registerHook('SessionEnd', async (payload) => {
    const userId = typeof payload.userId === 'string' ? payload.userId : '';
    const chatSessionId = typeof payload.chatSessionId === 'string' ? payload.chatSessionId : '';
    if (!userId || !chatSessionId || !Array.isArray(payload.messages)) {
      return { exit_code: 0, message: '' };
    }

    await getChatStore().appendTurnMessages(userId, chatSessionId, payload.messages as InternalMessage[]);
    Logger.info('ChatStore', `轮末落库完成 chatSessionId=${chatSessionId}`);
    return { exit_code: 0, message: '' };
  });
}
