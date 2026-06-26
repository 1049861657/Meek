import type { MemoryPort } from '../ports/memory-port.js';
import { setMemoryPort } from '../ports/memory-port.js';
import {
  logMemoryRecallSkipped,
  recallForPrompt,
  retainConversation,
  resolveHindsightBankId,
} from './hindsight-memory-provider.js';

export function createHindsightMemoryPort(): MemoryPort {
  return {
    retainConversation,
    recallForPrompt,
    resolveHindsightBankId,
    logMemoryRecallSkipped,
  };
}

export function installMemoryPort(): void {
  setMemoryPort(createHindsightMemoryPort());
}
