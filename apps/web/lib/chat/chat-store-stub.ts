import type { InternalMessage } from '@meek/agent-core';
import { ChatStore } from '@meek/chat-store';

export async function assembleContextMessages(
  userId: string,
  chatSessionId: string,
  options?: { messageHistoryCount?: number },
): Promise<InternalMessage[]> {
  return ChatStore.assembleContextMessages(userId, chatSessionId, options);
}
