import {
  MAX_TOOL_CALL_ROUNDS_MAX,
  MAX_TOOL_CALL_ROUNDS_MIN,
  TOOL_PROMPT_MAX_LENGTH,
} from './constants';
import type {
  ChannelConfigFormPayload,
  ChannelConfigSaveResult,
  ChannelConfigState,
  ChannelProfile,
  PermissionMode,
  ProviderOption,
} from './types';

export function formatToolPromptCharCount(length: number): string {
  return `${length} / ${TOOL_PROMPT_MAX_LENGTH}`;
}

export function mcpNameInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0) : '?';
}

export function clampMaxToolCallRounds(value: number): number {
  if (!Number.isFinite(value)) {
    return MAX_TOOL_CALL_ROUNDS_MIN;
  }
  return Math.min(
    MAX_TOOL_CALL_ROUNDS_MAX,
    Math.max(MAX_TOOL_CALL_ROUNDS_MIN, Math.floor(value)),
  );
}

export function resolveEffectiveVendor(
  profile: ChannelProfile,
  providers: ProviderOption[],
): string {
  const savedVendor = typeof profile.vendor === 'string' ? profile.vendor : '';
  if (savedVendor && providers.some((p) => p.name === savedVendor)) {
    return savedVendor;
  }
  return providers[0]?.name ?? '';
}

export function buildModelOptions(
  provider: ProviderOption | undefined,
  selected: unknown,
): Array<{ value: string; label: string }> {
  if (!provider) {
    return [{ value: '', label: '—' }];
  }
  const values = new Map<string, string>();
  values.set(provider.defaultModel, provider.defaultModel);
  for (const model of provider.models) {
    values.set(model.value, model.label || model.value);
  }
  const selectedVal = typeof selected === 'string' ? selected : provider.defaultModel;
  return [...values.entries()].map(([value, label]) => ({
    value,
    label: value === selectedVal ? label : label,
  }));
}

export function resolveSelectedModel(
  provider: ProviderOption | undefined,
  prev: string,
): string {
  if (!provider) {
    return prev;
  }
  const allowed = new Set([provider.defaultModel, ...provider.models.map((m) => m.value)]);
  return allowed.has(prev) ? prev : provider.defaultModel;
}

export function getChannelConfigSaveValidationError(
  providers: ProviderOption[],
  form: Pick<ChannelConfigFormPayload, 'vendor' | 'defaultModel'>,
): string | null {
  if (providers.length === 0) {
    return '绑定账号尚未配置 AI 供应商，请先在「配置管理」中配置';
  }
  if (!form.defaultModel) {
    return '请选择对话模型';
  }
  return null;
}

export function buildChannelConfigSaveNotice(result: ChannelConfigSaveResult): {
  variant: 'success' | 'info';
  message: string;
  inline: string;
} {
  const skipped = result.skippedMcpServers ?? [];
  const skippedText = skipped.map((s) => s.name).join('、');

  if (skipped.length === 0) {
    return {
      variant: 'success',
      message: '渠道配置已保存',
      inline: '已保存',
    };
  }

  return {
    variant: 'info',
    message: `渠道配置已保存。${skippedText} 无法连接`,
    inline: `已保存，${skippedText} 无法连接`,
  };
}

export function applyAccountDefaultsToForm(
  state: ChannelConfigState,
): ChannelConfigFormPayload {
  const defaults = state.accountDefaults ?? {};
  const profile = state.profile;
  const providers = state.resources.providers;
  const effectiveVendor = resolveEffectiveVendor(
    { vendor: defaults.vendor ?? profile.vendor },
    providers,
  );
  const provider = providers.find((p) => p.name === effectiveVendor);
  const defaultModel =
    typeof defaults.defaultModel === 'string'
      ? defaults.defaultModel
      : (profile.defaultModel ?? provider?.defaultModel ?? '');
  const accountPrompt =
    typeof state.accountToolPrompt === 'string' ? state.accountToolPrompt : '';

  return {
    vendor: effectiveVendor || null,
    defaultModel,
    temperature: profile.temperature ?? 0.7,
    maxTokens: profile.maxTokens ?? 2048,
    enableTools: Boolean(profile.enableTools),
    enablePrompts: Boolean(profile.enablePrompts),
    permissionMode: (profile.permissionMode as PermissionMode) ?? 'locked',
    enableAutoCompact: Boolean(profile.enableAutoCompact),
    compactModel: profile.compactModel ?? defaultModel,
    mcpServerIds: Array.isArray(profile.mcpServerIds) ? [...profile.mcpServerIds] : [],
    maxToolCallRounds: profile.maxToolCallRounds ?? 25,
    toolPrompt: accountPrompt.slice(0, TOOL_PROMPT_MAX_LENGTH),
  };
}

export function profileToFormPayload(
  state: ChannelConfigState,
): ChannelConfigFormPayload {
  const profile = state.profile;
  const providers = state.resources.providers;
  const effectiveVendor = resolveEffectiveVendor(profile, providers);
  const provider = providers.find((p) => p.name === effectiveVendor);
  const defaultModel = profile.defaultModel ?? provider?.defaultModel ?? '';
  const savedToolPrompt = typeof profile.toolPrompt === 'string' ? profile.toolPrompt : '';

  return {
    vendor: effectiveVendor || null,
    defaultModel,
    temperature: profile.temperature ?? 0.7,
    maxTokens: profile.maxTokens ?? 2048,
    enableTools: Boolean(profile.enableTools),
    enablePrompts: Boolean(profile.enablePrompts),
    permissionMode: (profile.permissionMode as PermissionMode) ?? 'locked',
    enableAutoCompact: Boolean(profile.enableAutoCompact),
    compactModel: profile.compactModel ?? defaultModel,
    mcpServerIds: Array.isArray(profile.mcpServerIds) ? [...profile.mcpServerIds] : [],
    maxToolCallRounds: profile.maxToolCallRounds ?? 25,
    toolPrompt: savedToolPrompt,
  };
}

export function formPayloadToSaveBody(
  payload: ChannelConfigFormPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    vendor: payload.vendor,
    defaultModel: payload.defaultModel,
    temperature: payload.temperature,
    maxTokens: payload.maxTokens,
    enableTools: payload.enableTools,
    enablePrompts: payload.enablePrompts,
    permissionMode: payload.permissionMode,
    enableAutoCompact: payload.enableAutoCompact,
    compactModel: payload.enableAutoCompact ? payload.compactModel : null,
    mcpServerIds: payload.enableTools ? payload.mcpServerIds : [],
    maxToolCallRounds: payload.maxToolCallRounds,
  };
  if (payload.enablePrompts && payload.toolPrompt !== undefined) {
    body.toolPrompt = payload.toolPrompt;
  }
  return body;
}
