import type { AIProvidersConfigType } from '../providers/provider-types.js';

let config: AIProvidersConfigType = { providers: [], defaultProvider: null };

export function setAiProvidersConfig(next: AIProvidersConfigType): void {
  config = next;
}

export async function getAIProvidersConfig(
  _userId?: string
): Promise<AIProvidersConfigType> {
  return config;
}
