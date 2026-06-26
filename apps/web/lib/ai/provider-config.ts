import { ConfigService } from '@meek/config-plane';
import {
  invalidateProviderCache,
  setAiProvidersConfig,
  type AIProvidersConfigType,
} from '@meek/agent-core/provider';

/**
 * 从 ConfigService 加载 seed / per-user Provider 配置并注入 agent-core 端口。
 */
export async function loadAiProvidersConfig(
  configUserId: string | null
): Promise<AIProvidersConfigType> {
  const config = await ConfigService.getAIProvidersConfig(configUserId ?? undefined);
  setAiProvidersConfig(config);
  invalidateProviderCache(configUserId ?? undefined);
  return config;
}
