import {
  FeatureConfig,
  MemoryConfig,
  isHindsightMemoryConfigured,
  listSystemToolDescriptors,
  Logger,
} from '@meek/agent-core';
import type {
  FeatureConfigApiResponse,
  PublicFeatureConfig,
} from '@meek/shared';

export function buildPublicFeatureConfig(): PublicFeatureConfig {
  const { memory: _memorySecret, ...publicFeatureConfig } = FeatureConfig;

  return {
    ...publicFeatureConfig,
    memory: {
      enabled: isHindsightMemoryConfigured(),
      bankIdPrefix: MemoryConfig.bankIdPrefix,
    },
    systemTools: listSystemToolDescriptors(),
  };
}

export function handleGetFeatureConfig(): FeatureConfigApiResponse {
  try {
    Logger.info('API', '请求特性配置');
    return {
      success: true,
      config: buildPublicFeatureConfig(),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    Logger.error('API', `获取特性配置失败: ${message}`);
    return {
      error: '获取特性配置失败',
      message,
    };
  }
}
