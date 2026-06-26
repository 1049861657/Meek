/**
 * 特性 / 供应商 / 思考模式配置加载 — 对齐 config-fetch.js（纯 fetch，无 DOM）
 */

import { fetchJson } from '@/lib/api/fetch-json';

export interface SystemToolCatalogEntry {
  codeName: string;
  label?: string;
  summary?: string;
}

export interface ProviderModelOption {
  value: string;
  label: string;
}

export interface ProviderEntry {
  name: string;
  apiPath: string;
  models: ProviderModelOption[];
}

export interface FeatureConfigPayload {
  systemTools?: SystemToolCatalogEntry[];
  tools?: {
    enableMCPTools?: boolean;
    enablePrompts?: boolean;
    maxToolCallRounds?: number;
  };
  history?: {
    enableMessageHistory?: boolean;
    defaultMessageHistoryCount?: number;
  };
  context?: {
    enableAutoCompact?: boolean;
  };
  memory?: {
    enabled?: boolean;
  };
}

export interface FeatureConfigResult {
  systemToolCatalog: SystemToolCatalogEntry[];
  enableMCPTools: boolean;
  enablePrompts: boolean;
  maxToolCallRounds: number;
  enableMessageHistory: boolean;
  messageHistoryCount: number;
  enableAutoCompact: boolean;
  hindsightMemoryEnabled: boolean;
  enabledSystemToolNames: string[];
}

export interface ProviderConfigResult {
  providers: Record<string, ProviderEntry>;
  defaultProvider: string;
}

export interface ThinkingConfigResult {
  enabled: boolean;
  models: string[];
}

export async function fetchChatFeatureConfig(): Promise<FeatureConfigResult> {
  const data = (await fetchJson('/api/config/features')) as {
    success?: boolean;
    config?: FeatureConfigPayload;
    error?: string;
  };

  if (data.error) {
    throw new Error(`获取特性配置失败: ${data.error}`);
  }

  const config = data.success && data.config ? data.config : {};
  const systemTools = Array.isArray(config.systemTools) ? config.systemTools : [];

  return {
    systemToolCatalog: systemTools,
    enableMCPTools: config.tools?.enableMCPTools ?? true,
    enablePrompts: config.tools?.enablePrompts ?? true,
    maxToolCallRounds:
      typeof config.tools?.maxToolCallRounds === 'number' ? config.tools.maxToolCallRounds : 25,
    enableMessageHistory: config.history?.enableMessageHistory ?? true,
    messageHistoryCount: config.history?.defaultMessageHistoryCount ?? 20,
    enableAutoCompact: config.context?.enableAutoCompact ?? false,
    hindsightMemoryEnabled: config.memory?.enabled === true,
    enabledSystemToolNames: systemTools.map((tool) => tool.codeName),
  };
}

export async function fetchChatProviderConfig(): Promise<ProviderConfigResult> {
  const config = (await fetchJson('/api/settings/providers', {
    credentials: 'include',
    cache: 'no-store',
  })) as {
    providers: Array<{ name: string; models: ProviderModelOption[] }>;
    defaultProvider: string;
  };

  const providers: Record<string, ProviderEntry> = {};
  for (const provider of config.providers) {
    providers[provider.name] = {
      name: provider.name,
      apiPath: '/api/chat',
      models: provider.models,
    };
  }

  return {
    providers,
    defaultProvider: config.defaultProvider,
  };
}

export async function fetchThinkingConfig(): Promise<ThinkingConfigResult> {
  return {
    enabled: true,
    models: [
      'claude-3-5-sonnet-20240620',
      'gpt-4-0314',
      'gpt-4-0613',
      'gpt-4-1106-preview',
      'gpt-4-vision-preview',
      'gpt-4-turbo',
    ],
  };
}

export function getModelsForProvider(
  providers: Record<string, ProviderEntry>,
  providerName: string
): ProviderModelOption[] {
  return providers[providerName]?.models ?? [];
}

export function resolveCompactModel(
  providers: Record<string, ProviderEntry>,
  providerName: string,
  preferred?: string
): string {
  const models = getModelsForProvider(providers, providerName);
  if (preferred && models.some((m) => m.value === preferred)) {
    return preferred;
  }
  return models[0]?.value ?? '';
}
