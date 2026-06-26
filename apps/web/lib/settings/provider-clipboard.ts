import type { Provider } from '@/lib/settings/types';

const PROVIDER_CLIPBOARD_KIND = 'mcp-client/provider';
const PROVIDER_CLIPBOARD_VERSION = 1;

export function serializeProviderForClipboard(provider: Provider): string {
  const payload = {
    kind: PROVIDER_CLIPBOARD_KIND,
    version: PROVIDER_CLIPBOARD_VERSION,
    exportedAt: new Date().toISOString(),
    provider: {
      name: provider.name,
      type: provider.type,
      apiUrl: provider.apiUrl,
      apiKey: provider.apiKey,
      defaultModel: provider.defaultModel,
      models: (provider.models ?? []).map((model) => ({
        value: model.value,
        label: model.label,
      })),
    },
  };

  return JSON.stringify(payload, null, 2);
}

function isModelEntry(value: unknown): value is { value: string; label: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'value' in value &&
    typeof value.value === 'string' &&
    'label' in value &&
    typeof value.label === 'string'
  );
}

function isProviderShape(value: unknown): value is Provider {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.apiUrl === 'string' &&
    typeof candidate.apiKey === 'string' &&
    typeof candidate.defaultModel === 'string' &&
    Array.isArray(candidate.models) &&
    candidate.models.every(isModelEntry)
  );
}

export function parseProviderFromClipboard(text: string): Provider {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('剪贴板内容不是有效的 JSON');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('剪贴板格式无效');
  }

  const envelope = parsed as Record<string, unknown>;
  if (envelope.kind !== PROVIDER_CLIPBOARD_KIND) {
    throw new Error('剪贴板内容不是提供商配置');
  }

  if (envelope.version !== PROVIDER_CLIPBOARD_VERSION) {
    throw new Error('不支持的提供商配置版本');
  }

  if (!isProviderShape(envelope.provider)) {
    throw new Error('提供商配置字段不完整');
  }

  return {
    name: envelope.provider.name.trim(),
    type: envelope.provider.type.trim(),
    apiUrl: envelope.provider.apiUrl.trim(),
    apiKey: envelope.provider.apiKey.trim(),
    defaultModel: envelope.provider.defaultModel.trim(),
    models: envelope.provider.models
      .map((model) => ({
        value: model.value.trim(),
        label: model.label.trim(),
      }))
      .filter((model) => model.value.length > 0)
      .map((model) => ({
        value: model.value,
        label: model.label || model.value,
      })),
  };
}

export function resolveUniqueProviderName(name: string, existingNames: string[]): string {
  const base = name.trim() || '未命名提供商';
  if (!existingNames.includes(base)) {
    return base;
  }

  const copyName = `${base} (副本)`;
  if (!existingNames.includes(copyName)) {
    return copyName;
  }

  let index = 2;
  while (existingNames.includes(`${base} (副本 ${index})`)) {
    index += 1;
  }

  return `${base} (副本 ${index})`;
}

export function cloneProviderForImport(provider: Provider): Provider {
  return {
    name: provider.name,
    type: provider.type,
    apiUrl: provider.apiUrl,
    apiKey: provider.apiKey,
    defaultModel: provider.defaultModel,
    models: provider.models.map((model) => ({
      value: model.value,
      label: model.label,
    })),
  };
}
