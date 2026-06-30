import { ConfigService } from '@meek/config-plane';
import {
  commitProviderConfig,
  forceCommitProviderConfig,
  invalidateProviderCache,
  type AIProvidersConfigType,
} from '@meek/agent-core/provider';

/**
 * 热路径：从 DB 同步到端口；仅配置内容变化时失效 BFF bucket。
 */
export async function syncAiProvidersConfigPort(
  configUserId: string | null,
): Promise<AIProvidersConfigType> {
  const config = await ConfigService.getAIProvidersConfig(configUserId ?? undefined);
  if (commitProviderConfig(configUserId, config)) {
    invalidateProviderCache(configUserId ?? undefined);
  }
  return config;
}

/**
 * 设置页保存/重置：强制写入并失效缓存。
 */
export async function applyAiProvidersConfigUpdate(
  configUserId: string | null,
): Promise<AIProvidersConfigType> {
  const config = await ConfigService.getAIProvidersConfig(configUserId ?? undefined);
  forceCommitProviderConfig(configUserId, config);
  invalidateProviderCache(configUserId ?? undefined);
  return config;
}
