import { ContextConfig } from '@meek/agent-core';
import { parseImPermissionMode } from '@meek/agent-core/permission';
import { prisma } from '@meek/db';

import { ConfigService } from './config.service.js';
import { resolveChannelBindingContext } from './channel-binding.service.js';
import {
  CHANNEL_DEFAULT_PROFILE_BY_CHANNEL,
  type EditableImChannelProfileId,
  type ImPermissionMode,
} from './config-plane.types.js';
import { partitionMcpServerIdsForPersistence } from './mcp-reachability-port.js';

export interface ChannelConfigProviderOption {
  name: string;
  defaultModel: string;
  models: Array<{ value: string; label: string }>;
}

export interface ChannelConfigMcpOption {
  id: string;
  name: string;
  poolEnabled: boolean;
}

export interface ChannelConfigProfileValues {
  vendor: string | null;
  defaultModel: string;
  temperature: number | null;
  maxTokens: number | null;
  enableTools: boolean;
  enablePrompts: boolean;
  maxToolCallRounds: number;
  permissionMode: ImPermissionMode;
  enableAutoCompact: boolean;
  compactModel: string | null;
  mcpServerIds: string[];
  toolPrompt: string | null;
}

export interface ChannelConfigAccountDefaults {
  vendor: string | null;
  defaultModel: string | null;
  mcpServerIds: string[];
}

export interface ChannelConfigEditorState {
  channel: 'dingtalk' | 'feishu';
  profileId: EditableImChannelProfileId;
  boundUserId: string | null;
  boundUsername: string | null;
  configUserId: string | null;
  profile: ChannelConfigProfileValues;
  resources: {
    providers: ChannelConfigProviderOption[];
    defaultProvider: string | null;
    mcpServers: ChannelConfigMcpOption[];
  };
  accountDefaults: ChannelConfigAccountDefaults;
  accountToolPrompt: string;
}

export interface ChannelConfigSaveInput {
  vendor?: string | null;
  defaultModel?: string;
  temperature?: number | null;
  maxTokens?: number | null;
  enableTools?: boolean;
  enablePrompts?: boolean;
  maxToolCallRounds?: number;
  permissionMode?: ImPermissionMode;
  enableAutoCompact?: boolean;
  compactModel?: string | null;
  mcpServerIds?: string[];
  toolPrompt?: string | null;
}

export interface ChannelConfigSaveResult {
  profile: ChannelConfigProfileValues;
  skippedMcpServers: Array<{ id: string; name: string }>;
}

function imChannelProfileId(channel: 'dingtalk' | 'feishu'): EditableImChannelProfileId {
  return CHANNEL_DEFAULT_PROFILE_BY_CHANNEL[channel] as EditableImChannelProfileId;
}

function mapProfileValues(row: {
  vendor: string | null;
  defaultModel: string;
  temperature: number | null;
  maxTokens: number | null;
  enableTools: boolean;
  enablePrompts: boolean;
  maxToolCallRounds: number;
  permissionMode: string;
  enableAutoCompact: boolean | null;
  compactModel: string | null;
  mcpServerIds: unknown;
  toolPrompt: string | null;
}): ChannelConfigProfileValues {
  let permissionMode: 'open' | 'locked' = 'locked';
  try {
    permissionMode = parseImPermissionMode(row.permissionMode);
  } catch {
    permissionMode = 'locked';
  }
  const mcpServerIds = Array.isArray(row.mcpServerIds)
    ? row.mcpServerIds.filter((id): id is string => typeof id === 'string')
    : [];

  return {
    vendor: row.vendor,
    defaultModel: row.defaultModel,
    temperature: row.temperature,
    maxTokens: row.maxTokens,
    enableTools: row.enableTools,
    enablePrompts: row.enablePrompts,
    maxToolCallRounds: row.maxToolCallRounds,
    permissionMode,
    enableAutoCompact: row.enableAutoCompact ?? ContextConfig.enableAutoCompact,
    compactModel: row.compactModel,
    mcpServerIds,
    toolPrompt: row.toolPrompt,
  };
}

async function loadBoundAccountResources(configUserId: string | null): Promise<{
  providers: ChannelConfigProviderOption[];
  defaultProvider: string | null;
  mcpServers: ChannelConfigMcpOption[];
  accountDefaults: ChannelConfigAccountDefaults;
}> {
  const [providersConfig, mcpConfig] = await Promise.all([
    ConfigService.getAIProvidersConfig(configUserId ?? undefined),
    ConfigService.getMCPConfig(configUserId ?? undefined),
  ]);

  const providers: ChannelConfigProviderOption[] = (providersConfig.providers ?? []).map((p) => ({
    name: p.name,
    defaultModel: p.defaultModel,
    models: p.models.map((m) => ({ value: m.value, label: m.label })),
  }));

  const defaultProvider = providersConfig.defaultProvider?.trim() || providers[0]?.name || null;
  const defaultProviderRow = defaultProvider
    ? providers.find((p) => p.name === defaultProvider)
    : undefined;

  const mcpServers: ChannelConfigMcpOption[] = mcpConfig.servers.map((s) => ({
    id: s.serverId,
    name: s.name,
    poolEnabled: s.enabled,
  }));

  return {
    providers,
    defaultProvider,
    mcpServers,
    accountDefaults: {
      vendor: defaultProvider,
      defaultModel: defaultProviderRow?.defaultModel ?? null,
      mcpServerIds: mcpServers.map((s) => s.id),
    },
  };
}

function findProvider(
  providers: ChannelConfigProviderOption[],
  vendor: string | null | undefined
): ChannelConfigProviderOption | undefined {
  if (!vendor) {
    return undefined;
  }
  return providers.find((p) => p.name === vendor);
}

function assertModelInProvider(
  provider: ChannelConfigProviderOption | undefined,
  model: string,
  fieldLabel: string
): void {
  if (!provider) {
    throw new Error('请先选择绑定账号下可用的供应商');
  }
  const allowed = new Set(provider.models.map((m) => m.value));
  allowed.add(provider.defaultModel);
  if (!allowed.has(model)) {
    throw new Error(`${fieldLabel}「${model}」不在供应商「${provider.name}」的模型列表中`);
  }
}

export async function getChannelConfigEditorState(options: {
  channel: 'dingtalk' | 'feishu';
  boundUserId?: string | null;
}): Promise<ChannelConfigEditorState> {
  const binding = await resolveChannelBindingContext({
    channel: options.channel,
    boundUserId: options.boundUserId,
  });
  const profileId = imChannelProfileId(options.channel);

  const row = await prisma.agentProfile.findUnique({ where: { profileId } });
  if (!row) {
    throw new Error(`渠道方案 ${profileId} 不存在，请先执行 seed`);
  }

  const [resources, boundUser, accountToolPromptRaw] = await Promise.all([
    loadBoundAccountResources(binding.configUserId),
    binding.boundUserId || binding.configUserId
      ? prisma.user.findUnique({
          where: { id: binding.boundUserId ?? binding.configUserId ?? '' },
          select: { username: true },
        })
      : Promise.resolve(null),
    ConfigService.getSetting('mcpToolPrompt', binding.configUserId ?? undefined),
  ]);

  return {
    channel: options.channel,
    profileId,
    boundUserId: binding.boundUserId,
    boundUsername: boundUser?.username ?? null,
    configUserId: binding.configUserId,
    profile: mapProfileValues(row),
    resources: {
      providers: resources.providers,
      defaultProvider: resources.defaultProvider,
      mcpServers: resources.mcpServers,
    },
    accountDefaults: resources.accountDefaults,
    accountToolPrompt: accountToolPromptRaw != null ? String(accountToolPromptRaw) : '',
  };
}

export async function saveChannelConfig(options: {
  channel: 'dingtalk' | 'feishu';
  boundUserId?: string | null;
  input: ChannelConfigSaveInput;
}): Promise<ChannelConfigSaveResult> {
  const binding = await resolveChannelBindingContext({
    channel: options.channel,
    boundUserId: options.boundUserId,
  });
  const profileId = imChannelProfileId(options.channel);

  const existing = await prisma.agentProfile.findUnique({ where: { profileId } });
  if (!existing) {
    throw new Error(`渠道方案 ${profileId} 不存在`);
  }

  const { providers, mcpServers } = await loadBoundAccountResources(binding.configUserId);
  const poolMcpIds = new Set(mcpServers.map((s) => s.id));
  const input = options.input;

  const data: Record<string, unknown> = {};

  if (input.vendor !== undefined) {
    if (input.vendor !== null && !findProvider(providers, input.vendor)) {
      throw new Error(`供应商「${input.vendor}」不在绑定账号的配置列表中`);
    }
    data.vendor = input.vendor;
  }

  const effectiveVendor = input.vendor !== undefined ? input.vendor : existing.vendor;
  const providerRow = findProvider(providers, effectiveVendor);

  if (input.defaultModel !== undefined) {
    assertModelInProvider(providerRow, input.defaultModel, '对话模型');
    data.defaultModel = input.defaultModel.trim();
  }

  if (input.temperature !== undefined) {
    data.temperature = input.temperature;
  }
  if (input.maxTokens !== undefined) {
    data.maxTokens = input.maxTokens === null ? null : Math.floor(input.maxTokens);
  }
  if (input.enableTools !== undefined) {
    data.enableTools = input.enableTools;
  }
  if (input.enablePrompts !== undefined) {
    data.enablePrompts = input.enablePrompts;
  }
  if (input.maxToolCallRounds !== undefined) {
    data.maxToolCallRounds = Math.floor(input.maxToolCallRounds);
  }
  if (input.permissionMode !== undefined) {
    data.permissionMode = parseImPermissionMode(input.permissionMode);
  }
  if (input.enableAutoCompact !== undefined) {
    data.enableAutoCompact = input.enableAutoCompact;
  }
  if (input.compactModel !== undefined) {
    if (input.compactModel !== null) {
      assertModelInProvider(providerRow, input.compactModel, '压缩模型');
    }
    data.compactModel = input.compactModel;
  }
  if (input.toolPrompt !== undefined) {
    data.toolPrompt = input.toolPrompt;
  }

  let skippedMcpServers: Array<{ id: string; name: string }> = [];
  if (input.mcpServerIds !== undefined) {
    const uniqueIds = [...new Set(input.mcpServerIds)];
    for (const id of uniqueIds) {
      if (!poolMcpIds.has(id)) {
        throw new Error(`MCP「${id}」不在绑定账号的配置列表中`);
      }
    }

    const enableTools =
      typeof input.enableTools === 'boolean' ? input.enableTools : existing.enableTools;

    const partition = await partitionMcpServerIdsForPersistence(
      uniqueIds,
      binding.configUserId,
      enableTools
    );
    data.mcpServerIds = partition.persistIds;
    skippedMcpServers = partition.skipped;
  }

  if (Object.keys(data).length === 0) {
    throw new Error('未提供可更新的配置字段');
  }

  const updated = await prisma.agentProfile.update({
    where: { profileId },
    data,
  });

  return {
    profile: mapProfileValues(updated),
    skippedMcpServers,
  };
}
