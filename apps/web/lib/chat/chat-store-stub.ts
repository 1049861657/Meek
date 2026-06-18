import type { InternalMessage } from '@meek/agent-core';

export async function assembleContextMessages(
  _userId: string,
  _chatSessionId: string,
  _options?: { messageHistoryCount?: number }
): Promise<InternalMessage[]> {
  throw new Error('会话历史未实现：M4 ChatStore 注入后由服务端组装');
}
