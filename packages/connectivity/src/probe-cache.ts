import { createHash } from 'crypto';

import type { ProviderProbeResult } from './provider-probe.js';
import { LRUCache } from 'lru-cache';

const PROBE_CACHE_TTL_MS = 30_000;
const PROBE_CACHE_MAX = 256;

const probeResultCache = new LRUCache<string, ProviderProbeResult>({
  max: PROBE_CACHE_MAX,
  ttl: PROBE_CACHE_TTL_MS,
});

export function buildProbeCacheKey(
  userId: string,
  providerName: string,
  apiUrl: string,
  apiKey: string,
  model: string,
): string {
  const fingerprint = createHash('sha256')
    .update(`${apiUrl}\0${apiKey}\0${model}`)
    .digest('hex')
    .slice(0, 16);
  return `${userId}:${providerName}:${fingerprint}`;
}

export function getCachedProbeResult(cacheKey: string): ProviderProbeResult | undefined {
  return probeResultCache.get(cacheKey);
}

export function setCachedProbeResult(cacheKey: string, result: ProviderProbeResult): void {
  probeResultCache.set(cacheKey, result);
}
