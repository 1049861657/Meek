import type { InternalMessage } from '../types.js';

export interface ChatStorePort {
  appendTurnMessages(
    userId: string,
    chatSessionId: string,
    messages: InternalMessage[]
  ): Promise<void>;
  updateCompactBaseline?(
    userId: string,
    chatSessionId: string,
    baseline: { summaryContent: string; compactedAt: string }
  ): Promise<void>;
}

let chatStore: ChatStorePort | undefined;

export function setChatStore(store: ChatStorePort): void {
  chatStore = store;
}

export function getChatStore(): ChatStorePort {
  if (!chatStore) {
    throw new Error('ChatStorePort 未注入：调用 setChatStore');
  }
  return chatStore;
}
