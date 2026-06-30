import { LRUCache } from 'lru-cache';
import { McpPoolConfig } from '../config/feature-config.js';
import { getAIProvidersConfig } from '../ports/provider-config-port.js';
import { Logger } from '../lib/logger.js';
import { AiProvider } from './ai-provider.js';

/** 每个用户（含 seed/null）的供应商实例桶 */
interface ProviderBucket {
  services: Map<string, AiProvider>;
  defaultService: AiProvider | undefined;
}

const bucketCache = new LRUCache<string, ProviderBucket>({
  max: McpPoolConfig.providerBucketMax,
  ttl: McpPoolConfig.providerBucketTtlMs,
});

async function loadProviderBucket(userId: string | null): Promise<ProviderBucket> {
  const config = await getAIProvidersConfig(userId ?? undefined);
  const services = new Map<string, AiProvider>();

  for (const provider of config.providers ?? []) {
    services.set(provider.name, new AiProvider(provider));
  }

  const defaultName = (config.defaultProvider ?? '').trim() || (config.providers?.[0]?.name ?? '');
  const defaultService = defaultName ? services.get(defaultName) : services.values().next().value;

  return { services, defaultService };
}

function bucketCacheKey(userId: string | null): string {
  return userId ?? 'null';
}

async function getBucket(userId: string | null): Promise<ProviderBucket> {
  const key = bucketCacheKey(userId);
  const cached = bucketCache.get(key);
  if (cached !== undefined) return cached;

  const bucket = await loadProviderBucket(userId);
  bucketCache.set(key, bucket);
  Logger.info('AI', `Provider bucket loaded userId=${key} providers=${bucket.services.size}`);
  return bucket;
}

/**
 * per-user 解析供应商实例；userId=null → seed bucket。
 * DB 故障时回退 seed bucket（不中断聊天）；seed 本身失败向上抛。
 */
export async function getProviderForUser(
  userId: string | null,
  vendor?: string
): Promise<AiProvider | undefined> {
  await ensureProvidersInitialized();
  try {
    const bucket = await getBucket(userId);
    if (vendor && bucket.services.has(vendor)) return bucket.services.get(vendor);
    return bucket.defaultService;
  } catch (error) {
    Logger.error('AI', `getProviderForUser 失败 userId=${userId ?? 'null'}:`, error);
    if (userId !== null) {
      // 回退 seed bucket（高可用，不中断聊天）
      try {
        const seed = await getBucket(null);
        if (vendor && seed.services.has(vendor)) return seed.services.get(vendor);
        return seed.defaultService;
      } catch {
        // seed 也失败：向上抛原始错误
      }
    }
    return undefined;
  }
}

/**
 * 失效指定用户的 Provider bucket 缓存（配置保存后调用）。
 * 不传 userId 时失效全部缓存（seed 变更影响所有用户）。
 */
export function invalidateProviderCache(userId?: string): void {
  if (userId !== undefined) {
    bucketCache.delete(bucketCacheKey(userId));
  } else if (bucketCache.size > 0) {
    bucketCache.clear();
  }
}

// ---------------------------------------------------------------------------
// 向后兼容：全局 seed bucket（热路径启动预热；非 per-user 场景）
// ---------------------------------------------------------------------------
export const providerServices: Record<string, AiProvider> = {};
export let aiService: AiProvider | undefined;
let isInitialized = false;

async function syncSeedToGlobals(bucket: ProviderBucket): Promise<void> {
  Object.keys(providerServices).forEach(k => delete providerServices[k]);
  for (const [name, svc] of bucket.services) {
    providerServices[name] = svc;
  }
  aiService = bucket.defaultService;
}

export async function initializeProviders(): Promise<void> {
  try {
    const bucket = await loadProviderBucket(null);
    bucketCache.set('null', bucket);
    await syncSeedToGlobals(bucket);
    isInitialized = true;
    Logger.info('AI', '所有AI提供商服务初始化完成');
  } catch (error) {
    Logger.error('AI', '初始化AI提供商服务失败:', error);
    isInitialized = true;
  }
}

/**
 * 重新加载指定用户（或 seed）的 Provider 配置。
 * - userId 有值：仅失效该用户缓存，重新加载并返回其 bucket 信息
 * - userId 无值（undefined）：重新加载 seed → 同步到全局兼容 Map
 */
export async function reloadAiProviders(
  userId?: string
): Promise<{ providers: string[]; default: string }> {
  Logger.info('AI', `重新加载AI提供商配置 userId=${userId ?? 'seed'}`);
  try {
    if (userId !== undefined) {
      bucketCache.delete(userId);
    } else {
      bucketCache.delete('null');
    }

    const bucket = await getBucket(userId ?? null);

    if (userId === undefined) {
      // seed 变更：同步到全局兼容 Map
      await syncSeedToGlobals(bucket);
    }

    const defaultName = bucket.defaultService
      ? ([...bucket.services.entries()].find(([, v]) => v === bucket.defaultService)?.[0] ?? '')
      : '';

    return {
      providers: [...bucket.services.keys()],
      default: defaultName
    };
  } catch (error) {
    Logger.error('AI', '重新加载AI提供商配置失败:', error);
    throw error;
  }
}

// 懒初始化：禁止模块加载时副作用（对齐 MCP SDK / Turbo Compiled Package 实践）
let initPromise: Promise<void> | null = null;

/** 首次 getProviderForUser 前可显式预热；幂等 */
export function ensureProvidersInitialized(): Promise<void> {
  initPromise ??= initializeProviders();
  return initPromise;
}
