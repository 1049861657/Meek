/** Web BFF：LLM Provider 与压缩（轻量路径，不牵出 Harness / 落盘） */
export {
  getCompactProviderForUser as getProviderForUser,
  invalidateCompactProviderCache as invalidateProviderCache,
} from '../providers/provider-bff.js';

export { setAiProvidersConfig } from '../ports/provider-config-port.js';

export { OpenAiCompactProvider as AiProvider } from '../providers/openai-compact-provider.js';

export type { AIProvider as AIProviderConfig, AIProvidersConfigType, AIModel } from '../providers/provider-types.js';

export type { InternalMessage } from '../types.js';
