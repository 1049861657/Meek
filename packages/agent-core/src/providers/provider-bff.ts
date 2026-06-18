import { LRUCache } from 'lru-cache';

import { McpPoolConfig } from '../config/feature-config.js';
import { getAIProvidersConfig } from '../ports/provider-config-port.js';
import { Logger } from '../lib/logger.js';
import { OpenAiCompactProvider } from './openai-compact-provider.js';

interface ProviderBucket {
  services: Map<string, OpenAiCompactProvider>;
  defaultService: OpenAiCompactProvider | undefined;
}

const bucketCache = new LRUCache<string, ProviderBucket>({
  max: McpPoolConfig.providerBucketMax,
  ttl: McpPoolConfig.providerBucketTtlMs,
});

function bucketCacheKey(userId: string | null): string {
  return userId ?? 'null';
}

async function loadProviderBucket(userId: string | null): Promise<ProviderBucket> {
  const config = await getAIProvidersConfig(userId ?? undefined);
  const services = new Map<string, OpenAiCompactProvider>();

  for (const provider of config.providers ?? []) {
    services.set(provider.name, new OpenAiCompactProvider(provider));
  }

  const defaultName = (config.defaultProvider ?? '').trim() || (config.providers?.[0]?.name ?? '');
  const defaultService = defaultName ? services.get(defaultName) : services.values().next().value;

  return { services, defaultService };
}

async function getBucket(userId: string | null): Promise<ProviderBucket> {
  const key = bucketCacheKey(userId);
  const cached = bucketCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const bucket = await loadProviderBucket(userId);
  bucketCache.set(key, bucket);
  Logger.info('AI', `BFF provider bucket loaded userId=${key} providers=${bucket.services.size}`);
  return bucket;
}

export async function getCompactProviderForUser(
  userId: string | null,
  vendor?: string
): Promise<OpenAiCompactProvider | undefined> {
  try {
    const bucket = await getBucket(userId);
    if (vendor && bucket.services.has(vendor)) {
      return bucket.services.get(vendor);
    }
    return bucket.defaultService;
  } catch (error) {
    Logger.error('AI', `getCompactProviderForUser 失败 userId=${userId ?? 'null'}:`, error);
    if (userId !== null) {
      try {
        const seed = await getBucket(null);
        if (vendor && seed.services.has(vendor)) {
          return seed.services.get(vendor);
        }
        return seed.defaultService;
      } catch {
        // seed 也失败
      }
    }
    return undefined;
  }
}

export function invalidateCompactProviderCache(userId?: string): void {
  if (userId !== undefined) {
    bucketCache.delete(bucketCacheKey(userId));
  } else {
    bucketCache.clear();
  }
  Logger.info('AI', `BFF provider cache invalidated userId=${userId ?? 'all'}`);
}
