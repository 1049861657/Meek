export interface RetainConversationOptions {
  requestId?: string;
  documentSessionId?: string;
  conversationStartedAt?: string;
  signal?: AbortSignal;
}

export interface MemoryPort {
  retainConversation(
    bankId: string,
    content: string,
    options?: RetainConversationOptions
  ): Promise<void>;
  recallForPrompt(
    bankId: string,
    query: string,
    options?: { signal?: AbortSignal; requestId?: string }
  ): Promise<string>;
  resolveHindsightBankId(channel: string, key: string): string;
  logMemoryRecallSkipped(
    requestId: string | undefined,
    details: { bankId: string; query: string; reason: string }
  ): void;
}

let memoryPort: MemoryPort = {
  async retainConversation(): Promise<void> {
    throw new Error('MemoryPort 未注入：调用 setMemoryPort');
  },
  async recallForPrompt(): Promise<string> {
    throw new Error('MemoryPort 未注入：调用 setMemoryPort');
  },
  resolveHindsightBankId(_channel, key) {
    return `meek:${key}`;
  },
  logMemoryRecallSkipped() {
    /* 跳过记录：不依赖 Memory 后端 */
  },
};

export function setMemoryPort(port: MemoryPort): void {
  memoryPort = port;
}

export function getMemoryPort(): MemoryPort {
  return memoryPort;
}

/** @deprecated 使用 getMemoryPort().retainConversation */
export async function retainConversation(
  bankId: string,
  content: string,
  options?: RetainConversationOptions
): Promise<void> {
  return memoryPort.retainConversation(bankId, content, options);
}

/** @deprecated 使用 getMemoryPort().recallForPrompt */
export async function recallForPrompt(
  bankId: string,
  query: string,
  options?: { signal?: AbortSignal; requestId?: string }
): Promise<string> {
  return memoryPort.recallForPrompt(bankId, query, options);
}

export function resolveHindsightBankId(channel: string, key: string): string {
  return memoryPort.resolveHindsightBankId(channel, key);
}

export function logMemoryRecallSkipped(
  requestId: string | undefined,
  details: { bankId: string; query: string; reason: string }
): void {
  memoryPort.logMemoryRecallSkipped(requestId, details);
}
