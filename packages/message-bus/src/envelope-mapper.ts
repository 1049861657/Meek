import type { ChatOptions } from './channel.types.js';
import type { InternalMessage } from '@meek/agent-core';

export function pickDefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    const value = obj[key];
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export interface EnvelopeHarnessInput {
  messages: InternalMessage[];
  chatOptions: Partial<ChatOptions>;
}

export function envelopeToHarnessInput(
  envelope: { payload: { messages: InternalMessage[]; chatOptions?: ChatOptions } }
): EnvelopeHarnessInput {
  return {
    messages: envelope.payload.messages,
    chatOptions: pickDefined((envelope.payload.chatOptions ?? {}) as Record<string, unknown>) as Partial<ChatOptions>,
  };
}
