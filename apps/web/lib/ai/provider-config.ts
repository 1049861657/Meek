import { prisma } from '@meek/db';
import {
  invalidateProviderCache,
  setAiProvidersConfig,
  type AIProviderConfig,
  type AIProvidersConfigType,
} from '@meek/agent-core/provider';

async function readDefaultProviderName(userId: string | null): Promise<string | null> {
  const row = await prisma.setting.findFirst({
    where: { userId, key: 'defaultProvider' },
  });
  if (!row?.value || typeof row.value !== 'string') {
    return null;
  }
  return row.value;
}

function mapProviderRow(
  row: {
    name: string;
    type: string;
    apiUrl: string;
    apiKey: string;
    defaultModel: string;
    models: { value: string; label: string }[];
  }
): AIProviderConfig {
  return {
    name: row.name,
    type: row.type,
    apiUrl: row.apiUrl,
    apiKey: row.apiKey,
    defaultModel: row.defaultModel,
    models: row.models.map((model) => ({
      value: model.value,
      label: model.label,
    })),
  };
}

/**
 * 从 Prisma 加载 seed / per-user Provider 配置并注入 agent-core 端口。
 * M1-04：guest 使用 userId=null seed 池；已登录 per-user 覆盖待 M4 完善。
 */
export async function loadAiProvidersConfig(
  configUserId: string | null
): Promise<AIProvidersConfigType> {
  const rows = await prisma.aIProvider.findMany({
    where: { userId: configUserId },
    include: { models: true },
  });
  const providers = rows.map(mapProviderRow);
  const defaultProvider = await readDefaultProviderName(configUserId);
  const config: AIProvidersConfigType = { providers, defaultProvider };
  setAiProvidersConfig(config);
  invalidateProviderCache(configUserId ?? undefined);
  return config;
}
