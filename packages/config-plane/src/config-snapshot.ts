/**
 * 渠道配置平面：全局 AgentProfile + RouteRule 快照。
 */
import { ConfigChannelId, prisma } from '@meek/db';
import {
  ChatConfig,
  ToolsConfig,
} from '@meek/agent-core';
import { parsePermissionMode } from '@meek/agent-core/permission';
import type { ChannelId } from '@meek/shared';
import { LRUCache } from 'lru-cache';

import { ConfigService } from './config.service.js';
import type { AgentProfileRecord, ConfigPlaneSeedResult, RouteRuleRecord } from './config-plane.types.js';
import {
  CONFIG_PROFILE_DINGTALK_DEFAULT,
  CONFIG_PROFILE_FEISHU_DEFAULT,
  CONFIG_PROFILE_WEB_DEFAULT,
  ROUTE_MATCH_ALL,
} from './config-plane.types.js';
import { logInfo } from './logger.js';

export interface ConfigPlaneSnapshot {
  profiles: Map<string, AgentProfileRecord>;
  routesByChannel: Map<ChannelId, RouteRuleRecord[]>;
}

const SNAPSHOT_CACHE_TTL_MS = 60_000;
const CHANNEL_SNAPSHOT_CACHE_KEY = 'global';

const channelSnapshotCache = new LRUCache<string, ConfigPlaneSnapshot>({
  max: 1,
  ttl: SNAPSHOT_CACHE_TTL_MS,
});

let lastGoodChannelSnapshot: ConfigPlaneSnapshot | null = null;

function parseMcpServerIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

type ProfileRow = {
  profileId: string;
  displayName: string;
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
  tenantId: string | null;
  updatedAt: Date;
};

type RouteRow = {
  id: string;
  boundUserId: string | null;
  channel: ConfigChannelId;
  matchKey: string;
  profileId: string;
  priority: number;
  enabled: boolean;
  tenantId: string | null;
};

function mapProfileRow(row: ProfileRow): AgentProfileRecord {
  return {
    profileId: row.profileId,
    displayName: row.displayName,
    vendor: row.vendor,
    defaultModel: row.defaultModel,
    temperature: row.temperature,
    maxTokens: row.maxTokens,
    enableTools: row.enableTools,
    enablePrompts: row.enablePrompts,
    maxToolCallRounds: row.maxToolCallRounds,
    permissionMode: parsePermissionMode(row.permissionMode),
    enableAutoCompact: row.enableAutoCompact,
    compactModel: row.compactModel,
    mcpServerIds: parseMcpServerIds(row.mcpServerIds),
    toolPrompt: row.toolPrompt,
    tenantId: row.tenantId,
    updatedAt: row.updatedAt,
  };
}

function mapRouteRow(row: RouteRow): RouteRuleRecord {
  return {
    id: row.id,
    boundUserId: row.boundUserId,
    channel: row.channel as ChannelId,
    matchKey: row.matchKey,
    profileId: row.profileId,
    priority: row.priority,
    enabled: row.enabled,
    tenantId: row.tenantId,
  };
}

function buildSnapshotFromRows(
  profileRows: ProfileRow[],
  routeRows: RouteRow[]
): ConfigPlaneSnapshot {
  const profiles = new Map<string, AgentProfileRecord>();
  for (const row of profileRows) {
    profiles.set(row.profileId, mapProfileRow(row));
  }

  const routesByChannel = new Map<ChannelId, RouteRuleRecord[]>();
  for (const row of routeRows) {
    const channel = row.channel as ChannelId;
    const list = routesByChannel.get(channel) ?? [];
    list.push(mapRouteRow(row));
    routesByChannel.set(channel, list);
  }
  for (const list of routesByChannel.values()) {
    list.sort((a, b) => a.priority - b.priority);
  }

  return { profiles, routesByChannel };
}

async function loadChannelSnapshotFromDb(): Promise<ConfigPlaneSnapshot> {
  const [profileRows, routeRows] = await Promise.all([
    prisma.agentProfile.findMany({ orderBy: { profileId: 'asc' } }),
    prisma.routeRule.findMany({ orderBy: [{ channel: 'asc' }, { priority: 'asc' }] }),
  ]);
  return buildSnapshotFromRows(profileRows, routeRows);
}

export async function resolveChannelSnapshot(): Promise<ConfigPlaneSnapshot> {
  const cached = channelSnapshotCache.get(CHANNEL_SNAPSHOT_CACHE_KEY);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const snapshot = await loadChannelSnapshotFromDb();
    channelSnapshotCache.set(CHANNEL_SNAPSHOT_CACHE_KEY, snapshot);
    lastGoodChannelSnapshot = snapshot;
    return snapshot;
  } catch (error) {
    if (lastGoodChannelSnapshot !== null) {
      console.error('[CONFIG] channel snapshot DB error, falling back to last good:', error);
      return lastGoodChannelSnapshot;
    }
    throw error;
  }
}

/** @deprecated 渠道表已全局化 */
export async function resolveUserSnapshot(_userId: string | null): Promise<ConfigPlaneSnapshot> {
  return resolveChannelSnapshot();
}

export function invalidateChannelSnapshot(): void {
  channelSnapshotCache.delete(CHANNEL_SNAPSHOT_CACHE_KEY);
}

/** @deprecated 使用 invalidateChannelSnapshot */
export function invalidateConfigCache(_userId?: string): void {
  invalidateChannelSnapshot();
}

async function resolveSeedDefaultModel(): Promise<{ vendor: string | null; defaultModel: string }> {
  const providersConfig = await ConfigService.getAIProvidersConfig();
  const providers = providersConfig.providers ?? [];
  if (providers.length === 0) {
    return { vendor: null, defaultModel: 'default' };
  }
  const fallback = providers[0]!;
  const preferredName = providersConfig.defaultProvider?.trim() || fallback.name;
  const provider = providers.find((item) => item.name === preferredName) ?? fallback;
  return { vendor: provider.name, defaultModel: provider.defaultModel };
}

async function buildDefaultProfileData(
  profileId: string,
  displayName: string
): Promise<AgentProfileRecord> {
  const { vendor, defaultModel } = await resolveSeedDefaultModel();
  const enabledIds = await ConfigService.getSetting('mcpEnabledToolServerIds');
  const toolPromptRaw = await ConfigService.getSetting('mcpToolPrompt');
  const legacyEnabledIds = Array.isArray(enabledIds)
    ? enabledIds.filter((id): id is string => typeof id === 'string')
    : [];
  const mcpServerIds =
    profileId === CONFIG_PROFILE_WEB_DEFAULT ? [] : legacyEnabledIds;

  return {
    profileId,
    displayName,
    vendor,
    defaultModel,
    temperature: ChatConfig.defaultTemperature,
    maxTokens: ChatConfig.defaultMaxTokens,
    enableTools: ToolsConfig.enableMCPTools,
    enablePrompts: false,
    maxToolCallRounds: ToolsConfig.maxToolCallRounds,
    permissionMode: profileId === CONFIG_PROFILE_WEB_DEFAULT ? 'open' : 'locked',
    enableAutoCompact: true,
    compactModel: null,
    mcpServerIds,
    toolPrompt: toolPromptRaw != null ? String(toolPromptRaw) : null,
    tenantId: null,
    updatedAt: new Date(),
  };
}

const CHANNEL_DEFAULT_PROFILES = [
  { profileId: CONFIG_PROFILE_WEB_DEFAULT, displayName: 'Web 默认' },
  { profileId: CONFIG_PROFILE_FEISHU_DEFAULT, displayName: '飞书默认' },
  { profileId: CONFIG_PROFILE_DINGTALK_DEFAULT, displayName: '钉钉默认' },
] as const;

const CHANNEL_DEFAULT_ROUTES: Array<{ channel: ConfigChannelId; profileId: string }> = [
  { channel: 'web', profileId: CONFIG_PROFILE_WEB_DEFAULT },
  { channel: 'feishu', profileId: CONFIG_PROFILE_FEISHU_DEFAULT },
  { channel: 'dingtalk', profileId: CONFIG_PROFILE_DINGTALK_DEFAULT },
];

async function createDefaultProfile(profileId: string, displayName: string): Promise<void> {
  const profile = await buildDefaultProfileData(profileId, displayName);
  await prisma.agentProfile.create({
    data: {
      profileId: profile.profileId,
      displayName: profile.displayName,
      vendor: profile.vendor,
      defaultModel: profile.defaultModel,
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
      enableTools: profile.enableTools,
      enablePrompts: profile.enablePrompts,
      maxToolCallRounds: profile.maxToolCallRounds,
      permissionMode: profile.permissionMode,
      enableAutoCompact: profile.enableAutoCompact,
      compactModel: profile.compactModel,
      mcpServerIds: profile.mcpServerIds,
      toolPrompt: profile.toolPrompt,
      tenantId: profile.tenantId,
    },
  });
}

export async function ensureChannelDefaultProfilesAndRoutes(): Promise<{
  createdProfiles: number;
  createdRoutes: number;
}> {
  let createdProfiles = 0;
  let createdRoutes = 0;

  for (const item of CHANNEL_DEFAULT_PROFILES) {
    const existing = await prisma.agentProfile.findUnique({
      where: { profileId: item.profileId },
    });
    if (existing) {
      continue;
    }
    await createDefaultProfile(item.profileId, item.displayName);
    createdProfiles += 1;
  }

  for (const route of CHANNEL_DEFAULT_ROUTES) {
    const existing = await prisma.routeRule.findUnique({
      where: {
        channel_matchKey: { channel: route.channel, matchKey: ROUTE_MATCH_ALL },
      },
    });
    if (existing) {
      continue;
    }
    await prisma.routeRule.create({
      data: {
        channel: route.channel,
        matchKey: ROUTE_MATCH_ALL,
        profileId: route.profileId,
        priority: 100,
        enabled: true,
      },
    });
    createdRoutes += 1;
  }

  if (createdProfiles > 0 || createdRoutes > 0) {
    logInfo(
      'CONFIG',
      `补齐渠道默认配置 profiles=${createdProfiles} routes=${createdRoutes}`
    );
  }

  return { createdProfiles, createdRoutes };
}

export async function seedConfigPlaneIfEmpty(): Promise<boolean> {
  const count = await prisma.agentProfile.count();
  if (count > 0) {
    return false;
  }

  for (const item of CHANNEL_DEFAULT_PROFILES) {
    await createDefaultProfile(item.profileId, item.displayName);
  }
  for (const route of CHANNEL_DEFAULT_ROUTES) {
    await prisma.routeRule.create({
      data: {
        channel: route.channel,
        matchKey: ROUTE_MATCH_ALL,
        profileId: route.profileId,
        priority: 100,
        enabled: true,
      },
    });
  }

  logInfo('CONFIG', 'Config plane seeded default AgentProfile and RouteRule rows');
  return true;
}

export async function runConfigPlaneSeed(): Promise<ConfigPlaneSeedResult> {
  const seededEmpty = await seedConfigPlaneIfEmpty();
  const { createdProfiles, createdRoutes } = seededEmpty
    ? { createdProfiles: 0, createdRoutes: 0 }
    : await ensureChannelDefaultProfilesAndRoutes();
  return { seededEmpty, createdProfiles, createdRoutes };
}

export async function initConfigPlane(): Promise<void> {
  await seedConfigPlaneIfEmpty();
  await ensureChannelDefaultProfilesAndRoutes();
  const snapshot = await loadChannelSnapshotFromDb();
  channelSnapshotCache.set(CHANNEL_SNAPSHOT_CACHE_KEY, snapshot);
  lastGoodChannelSnapshot = snapshot;
  logInfo('CONFIG', `Channel config plane loaded profiles=${snapshot.profiles.size}`);
}

export function reloadConfigPlaneSnapshot(): void {
  invalidateChannelSnapshot();
}
