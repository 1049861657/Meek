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

let chatStore: ChatStorePort = {
  async appendTurnMessages() {
    /* M4 前 noop */
  },
};

export function setChatStore(store: ChatStorePort): void {
  chatStore = store;
}

export function getChatStore(): ChatStorePort {
  return chatStore;
}
