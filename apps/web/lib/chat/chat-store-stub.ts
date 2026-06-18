import type { InternalMessage } from '@meek/agent-core';

/** M4 前：已登录会话历史由服务端组装（noop 返回空历史） */
export async function assembleContextMessages(
  _userId: string,
  _chatSessionId: string,
  _options?: { messageHistoryCount?: number }
): Promise<InternalMessage[]> {
  return [];
}
