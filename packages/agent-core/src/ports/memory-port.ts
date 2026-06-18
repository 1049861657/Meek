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

const noopMemoryPort: MemoryPort = {
  async retainConversation() {
    /* M4 前 noop */
  },
  async recallForPrompt() {
    return '';
  },
  resolveHindsightBankId(_channel, key) {
    return `meek:${key}`;
  },
  logMemoryRecallSkipped() {
    /* noop */
  },
};

let memoryPort: MemoryPort = noopMemoryPort;

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
