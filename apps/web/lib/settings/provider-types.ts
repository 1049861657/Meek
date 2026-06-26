import { ProviderType } from '@meek/db';

import type { ProviderTypeOption } from './types';

/** 与 MCP-Client `app.config.ts` ProviderTypes 对齐 */
export const PROVIDER_TYPES: ProviderTypeOption[] = [
  { value: ProviderType.OPENAI, label: 'OpenAI' },
];
