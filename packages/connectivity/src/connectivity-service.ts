import type { AIProvidersConfigType } from '@meek/agent-core/provider';

import {
  buildProbeCacheKey,
  getCachedProbeResult,
  setCachedProbeResult,
} from './probe-cache.js';
import {
  probeProviderModel,
  resolveDefaultProbeTarget,
  type ProviderProbeResult,
} from './provider-probe.js';

export type ConnectivityState = 'idle' | 'pending' | 'ok' | 'fail' | 'skipped';

export interface ProviderConnectivityStatus {
  state: ConnectivityState;
  message?: string;
  providerName?: string;
  model?: string;
  method?: ProviderProbeResult['method'];
  checkedAt?: number;
  startedAt?: number;
}

const statusByUser = new Map<string, ProviderConnectivityStatus>();
const pendingByUser = new Map<string, Promise<void>>();

function probeResultToStatus(
  result: ProviderProbeResult,
  startedAt: number,
): ProviderConnectivityStatus {
  return {
    state: result.level === 'fail' ? 'fail' : 'ok',
    message: result.message,
    providerName: result.providerName,
    model: result.model,
    method: result.method,
    startedAt,
    checkedAt: Date.now(),
  };
}

export function getProviderConnectivityStatus(userId: string): ProviderConnectivityStatus {
  return statusByUser.get(userId) ?? { state: 'idle' };
}

export function scheduleDefaultProviderProbe(
  userId: string,
  loadConfig: () => Promise<AIProvidersConfigType | null>,
): void {
  if (pendingByUser.has(userId)) {
    return;
  }

  const startedAt = Date.now();
  statusByUser.set(userId, { state: 'pending', startedAt });

  const task = (async (): Promise<void> => {
    try {
      const config = await loadConfig();
      if (!config) {
        statusByUser.set(userId, {
          state: 'fail',
          message: '未找到提供商配置',
          startedAt,
          checkedAt: Date.now(),
        });
        return;
      }

      const target = resolveDefaultProbeTarget(config);
      if (!target) {
        statusByUser.set(userId, {
          state: 'skipped',
          message: '未配置默认模型，已跳过连通检测',
          startedAt,
          checkedAt: Date.now(),
        });
        return;
      }

      const cacheKey = buildProbeCacheKey(
        userId,
        target.provider.name,
        target.provider.apiUrl,
        target.provider.apiKey,
        target.model,
      );
      const cached = getCachedProbeResult(cacheKey);
      if (cached) {
        statusByUser.set(userId, probeResultToStatus(cached, startedAt));
        return;
      }

      const result = await probeProviderModel(target.provider, target.model);
      setCachedProbeResult(cacheKey, result);
      statusByUser.set(userId, probeResultToStatus(result, startedAt));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '连通检测失败';
      statusByUser.set(userId, {
        state: 'fail',
        message,
        startedAt,
        checkedAt: Date.now(),
      });
    } finally {
      pendingByUser.delete(userId);
    }
  })();

  pendingByUser.set(userId, task);
}
