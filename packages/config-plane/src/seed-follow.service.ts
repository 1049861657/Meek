import { SETTING_SEED_FOLLOW_USER_ID } from './config-plane.types.js';
import { ConfigService } from './config.service.js';
import { prisma } from '@meek/db';
import { logInfo, logWarn } from './logger.js';

export interface SeedFollowState {
  userId: string | null;
  username: string | null;
}

export const BOOTSTRAP_SEED_USERNAME = 'seed';

const SEED_FOLLOW_CACHE_TTL_MS = 30_000;

let seedFollowUserIdCache: { value: string | null; expiresAt: number } | null = null;

function invalidateSeedFollowCache(): void {
  seedFollowUserIdCache = null;
}

async function getSeedFollowUserId(): Promise<string | null> {
  const now = Date.now();
  if (seedFollowUserIdCache && seedFollowUserIdCache.expiresAt > now) {
    return seedFollowUserIdCache.value;
  }

  const raw = await ConfigService.getSetting(SETTING_SEED_FOLLOW_USER_ID);
  if (typeof raw !== 'string' || !raw.trim()) {
    seedFollowUserIdCache = { value: null, expiresAt: now + SEED_FOLLOW_CACHE_TTL_MS };
    return null;
  }
  const userId = raw.trim();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    logWarn('SEED_FOLLOW', `seedFollowUserId 指向已删除账号 ${userId}，回退 null 行`);
    seedFollowUserIdCache = { value: null, expiresAt: now + SEED_FOLLOW_CACHE_TTL_MS };
    return null;
  }
  seedFollowUserIdCache = { value: userId, expiresAt: now + SEED_FOLLOW_CACHE_TTL_MS };
  return userId;
}

export async function getSeedFollowState(): Promise<SeedFollowState> {
  const userId = await getSeedFollowUserId();
  if (!userId) {
    return { userId: null, username: null };
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { username: true },
  });
  return { userId, username: user?.username ?? null };
}

export async function resolveConfigUserId(options: {
  requestUserId?: string;
  boundUserId?: string | null;
}): Promise<string | null> {
  if (options.requestUserId) {
    return options.requestUserId;
  }
  if (options.boundUserId) {
    return options.boundUserId;
  }
  return getSeedFollowUserId();
}

export async function resolveGuestConfigUserId(): Promise<string | undefined> {
  const followId = await getSeedFollowUserId();
  return followId ?? undefined;
}

export async function ensureSeedFollowDefault(): Promise<void> {
  const current = await getSeedFollowUserId();
  if (current) {
    return;
  }
  const seedUser = await prisma.user.findUnique({
    where: { username: BOOTSTRAP_SEED_USERNAME },
    select: { id: true },
  });
  if (!seedUser) {
    logWarn('SEED_FOLLOW', `bootstrap 账号 ${BOOTSTRAP_SEED_USERNAME} 不存在，跳过默认配置归属`);
    return;
  }
  await setSeedFollowUserId(seedUser.id);
  logInfo('SEED_FOLLOW', `默认配置归属已初始化为 ${BOOTSTRAP_SEED_USERNAME}`);
}

export async function setSeedFollowUserId(userId: string | null): Promise<void> {
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw new Error('用户不存在');
    }
    await ConfigService.saveSetting(SETTING_SEED_FOLLOW_USER_ID, userId);
  } else {
    await prisma.setting.deleteMany({
      where: { userId: null, key: SETTING_SEED_FOLLOW_USER_ID },
    });
  }
  invalidateSeedFollowCache();
  logInfo('SEED_FOLLOW', `默认配置归属已更新 userId=${userId ?? 'null'}`);
}
