import {
  CHANNEL_DEFAULT_PROFILE_BY_CHANNEL,
  EDITABLE_IM_CHANNEL_PROFILE_IDS,
  ensureChannelDefaultProfilesAndRoutes,
  getChannelConfigEditorState,
  reloadConfigPlaneSnapshot,
  resolveChannelBindingContext,
  runConfigPlaneSeed,
  saveChannelConfig,
  type AgentProfileRecord,
} from '@meek/config-plane';
import { parseImPermissionMode } from '@meek/agent-core/permission';
import { ConfigChannelId, prisma } from '@meek/db';
import { McpReachabilityService } from '@meek/mcp-runtime';
import type { ChannelId } from '@meek/shared';

import { getChannelLinkStatusMap } from './channel-link-status';

const VALID_CHANNELS: ChannelId[] = ['web', 'feishu', 'dingtalk'];
const EDITABLE_PROFILE_IDS = new Set<string>(EDITABLE_IM_CHANNEL_PROFILE_IDS);

function adminError(status: number, error: string, details: string): Response {
  return Response.json({ error, details }, { status });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function parseChannel(value: unknown): ChannelId | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  return VALID_CHANNELS.includes(value as ChannelId) ? (value as ChannelId) : undefined;
}

function assertEditableProfileId(profileId: string): Response | null {
  if (!EDITABLE_PROFILE_IDS.has(profileId)) {
    return adminError(
      403,
      '不可编辑',
      `仅允许修改渠道默认方案：${EDITABLE_IM_CHANNEL_PROFILE_IDS.join('、')}`
    );
  }
  return null;
}

type ProfileRowRaw = {
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

function mapProfileRow(row: ProfileRowRaw): AgentProfileRecord {
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
    permissionMode: parseImPermissionMode(row.permissionMode),
    enableAutoCompact: row.enableAutoCompact,
    compactModel: row.compactModel,
    mcpServerIds: Array.isArray(row.mcpServerIds)
      ? row.mcpServerIds.filter((id): id is string => typeof id === 'string')
      : [],
    toolPrompt: row.toolPrompt,
    tenantId: row.tenantId,
    updatedAt: row.updatedAt,
  };
}

function reloadSuccess(extra?: Record<string, unknown>): Response {
  reloadConfigPlaneSnapshot();
  return Response.json({ success: true, ...extra });
}

export async function handleListProfiles(): Promise<Response> {
  try {
    const rows = await prisma.agentProfile.findMany({ orderBy: { profileId: 'asc' } });
    return Response.json(rows.map((r) => mapProfileRow(r)));
  } catch (error: unknown) {
    return adminError(500, '获取 Profile 列表失败', getErrorMessage(error));
  }
}

export async function handleGetProfile(profileId: string): Promise<Response> {
  if (!profileId) {
    return adminError(400, '参数无效', 'profileId 不能为空');
  }
  try {
    const row = await prisma.agentProfile.findUnique({ where: { profileId } });
    if (!row) {
      return adminError(404, '未找到', `Profile ${profileId} 不存在`);
    }
    return Response.json(mapProfileRow(row));
  } catch (error: unknown) {
    return adminError(500, '获取 Profile 失败', getErrorMessage(error));
  }
}

export function handleCreateProfile(): Response {
  return adminError(403, '不支持', '渠道方案不可新建，仅可修改钉钉/飞书默认方案');
}

export async function handleUpdateProfile(
  profileId: string,
  body: unknown
): Promise<Response> {
  if (!profileId) {
    return adminError(400, '参数无效', 'profileId 不能为空');
  }
  const editableError = assertEditableProfileId(profileId);
  if (editableError) {
    return editableError;
  }
  if (!isRecord(body)) {
    return adminError(400, '参数无效', '请求体无效');
  }

  try {
    const existing = await prisma.agentProfile.findUnique({ where: { profileId } });
    if (!existing) {
      return adminError(404, '未找到', `Profile ${profileId} 不存在`);
    }

    const data: Record<string, unknown> = {};
    if (typeof body.displayName === 'string') {
      data.displayName = body.displayName.trim();
    }
    if (typeof body.defaultModel === 'string') {
      data.defaultModel = body.defaultModel.trim();
    }
    if (typeof body.vendor === 'string') {
      data.vendor = body.vendor;
    }
    if (body.vendor === null) {
      data.vendor = null;
    }
    if (typeof body.temperature === 'number') {
      data.temperature = body.temperature;
    }
    if (body.temperature === null) {
      data.temperature = null;
    }
    if (typeof body.maxTokens === 'number') {
      data.maxTokens = Math.floor(body.maxTokens);
    }
    if (body.maxTokens === null) {
      data.maxTokens = null;
    }
    if (typeof body.enableTools === 'boolean') {
      data.enableTools = body.enableTools;
    }
    if (typeof body.enablePrompts === 'boolean') {
      data.enablePrompts = body.enablePrompts;
    }
    if (typeof body.maxToolCallRounds === 'number') {
      data.maxToolCallRounds = Math.floor(body.maxToolCallRounds);
    }
    if (body.permissionMode !== undefined) {
      data.permissionMode = parseImPermissionMode(body.permissionMode);
    }
    if (typeof body.enableAutoCompact === 'boolean') {
      data.enableAutoCompact = body.enableAutoCompact;
    }
    if (body.enableAutoCompact === null) {
      data.enableAutoCompact = null;
    }
    if (typeof body.compactModel === 'string') {
      data.compactModel = body.compactModel;
    }
    if (body.compactModel === null) {
      data.compactModel = null;
    }

    const mcpServerIds = parseStringArray(body.mcpServerIds);
    let skippedMcpServers: Array<{ id: string; name: string }> = [];
    if (mcpServerIds) {
      const enableTools =
        typeof body.enableTools === 'boolean' ? body.enableTools : existing.enableTools;
      const imChannel = (['dingtalk', 'feishu'] as const).find(
        (ch) => CHANNEL_DEFAULT_PROFILE_BY_CHANNEL[ch] === profileId
      );
      let reachabilityConfigUserId: string | null = null;
      if (imChannel) {
        const binding = await resolveChannelBindingContext({ channel: imChannel });
        reachabilityConfigUserId = binding.configUserId;
      }
      const partition = await McpReachabilityService.partitionForPersistence(
        mcpServerIds,
        reachabilityConfigUserId,
        enableTools
      );
      data.mcpServerIds = partition.persistIds;
      skippedMcpServers = partition.skipped;
    }
    if (typeof body.toolPrompt === 'string') {
      data.toolPrompt = body.toolPrompt;
    }
    if (body.toolPrompt === null) {
      data.toolPrompt = null;
    }

    await prisma.agentProfile.update({ where: { profileId }, data });
    console.info(`[ADMIN] 更新渠道 Profile ${profileId}`);
    return reloadSuccess(skippedMcpServers.length > 0 ? { skippedMcpServers } : undefined);
  } catch (error: unknown) {
    return adminError(500, '更新 Profile 失败', getErrorMessage(error));
  }
}

export function handleDeleteProfile(): Response {
  return adminError(403, '不支持', '渠道方案不可删除');
}

export function handleResetProfile(): Response {
  return adminError(410, '已废弃', '渠道方案为全局配置，不支持按用户重置');
}

export async function handleListRoutes(channelQuery: string | null): Promise<Response> {
  try {
    const { createdProfiles, createdRoutes } = await ensureChannelDefaultProfilesAndRoutes();
    if (createdProfiles > 0 || createdRoutes > 0) {
      reloadConfigPlaneSnapshot();
    }
    const channel = parseChannel(channelQuery);
    const channelFilter = channel ? { channel: channel as ConfigChannelId } : {};
    const rows = await prisma.routeRule.findMany({
      where: channelFilter,
      orderBy: [{ channel: 'asc' }, { priority: 'asc' }],
    });
    return Response.json(rows);
  } catch (error: unknown) {
    return adminError(500, '获取 Route 列表失败', getErrorMessage(error));
  }
}

export async function handleCreateRoute(body: unknown): Promise<Response> {
  if (!isRecord(body)) {
    return adminError(400, '参数无效', '请求体无效');
  }
  const channel = parseChannel(body.channel);
  const matchKey = typeof body.matchKey === 'string' ? body.matchKey.trim() : '';
  const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : '';
  if (!channel || !matchKey || !profileId) {
    return adminError(400, '参数无效', 'channel、matchKey、profileId 为必填');
  }
  const priority = typeof body.priority === 'number' ? Math.floor(body.priority) : 100;
  const enabled = typeof body.enabled === 'boolean' ? body.enabled : true;
  const boundUserId =
    typeof body.boundUserId === 'string' ? body.boundUserId.trim() || null : null;

  try {
    const row = await prisma.routeRule.create({
      data: {
        boundUserId,
        channel: channel as ConfigChannelId,
        matchKey,
        profileId,
        priority,
        enabled,
      },
    });
    console.info(`[ADMIN] 创建 Route ${row.id} channel=${channel}`);
    return reloadSuccess();
  } catch (error: unknown) {
    return adminError(500, '创建 Route 失败', getErrorMessage(error));
  }
}

export async function handleUpdateRoute(routeId: string, body: unknown): Promise<Response> {
  if (!routeId) {
    return adminError(400, '参数无效', 'routeId 不能为空');
  }
  if (!isRecord(body)) {
    return adminError(400, '参数无效', '请求体无效');
  }

  try {
    const existing = await prisma.routeRule.findUnique({ where: { id: routeId } });
    if (!existing) {
      return adminError(404, '未找到', `Route ${routeId} 不存在`);
    }
    const data: Record<string, unknown> = {};
    const channel = parseChannel(body.channel);
    if (channel) {
      data.channel = channel;
    }
    if (typeof body.matchKey === 'string') {
      data.matchKey = body.matchKey.trim();
    }
    if (typeof body.profileId === 'string') {
      data.profileId = body.profileId.trim();
    }
    if (typeof body.priority === 'number') {
      data.priority = Math.floor(body.priority);
    }
    if (typeof body.enabled === 'boolean') {
      data.enabled = body.enabled;
    }
    if (typeof body.boundUserId === 'string') {
      data.boundUserId = body.boundUserId.trim() || null;
    }
    if (body.boundUserId === null) {
      data.boundUserId = null;
    }

    await prisma.routeRule.update({ where: { id: routeId }, data });
    console.info(`[ADMIN] 更新 Route ${routeId}`);
    return reloadSuccess();
  } catch (error: unknown) {
    return adminError(500, '更新 Route 失败', getErrorMessage(error));
  }
}

export async function handleDeleteRoute(routeId: string): Promise<Response> {
  if (!routeId) {
    return adminError(400, '参数无效', 'routeId 不能为空');
  }
  try {
    const existing = await prisma.routeRule.findUnique({ where: { id: routeId } });
    if (!existing) {
      return adminError(404, '未找到', `Route ${routeId} 不存在`);
    }
    await prisma.routeRule.delete({ where: { id: routeId } });
    console.info(`[ADMIN] 删除 Route ${routeId}`);
    return reloadSuccess();
  } catch (error: unknown) {
    return adminError(500, '删除 Route 失败', getErrorMessage(error));
  }
}

export function handleGetChannelStatus(): Response {
  return Response.json(getChannelLinkStatusMap());
}

export async function handleGetChannelConfig(
  channelQuery: string | null,
  boundUserIdQuery: string | null
): Promise<Response> {
  const channel = parseChannel(channelQuery);
  if (channel !== 'dingtalk' && channel !== 'feishu') {
    return adminError(400, '参数无效', 'channel 须为 dingtalk 或 feishu');
  }
  const boundUserId =
    typeof boundUserIdQuery === 'string' && boundUserIdQuery.trim()
      ? boundUserIdQuery.trim()
      : null;

  try {
    const state = await getChannelConfigEditorState({ channel, boundUserId });
    return Response.json(state);
  } catch (error: unknown) {
    return adminError(500, '获取渠道配置失败', getErrorMessage(error));
  }
}

export async function handleSaveChannelConfig(body: unknown): Promise<Response> {
  if (!isRecord(body)) {
    return adminError(400, '参数无效', '请求体无效');
  }
  const channel = parseChannel(body.channel);
  if (channel !== 'dingtalk' && channel !== 'feishu') {
    return adminError(400, '参数无效', 'channel 须为 dingtalk 或 feishu');
  }
  const boundRaw = body.boundUserId;
  const boundUserId =
    typeof boundRaw === 'string' && boundRaw.trim() ? boundRaw.trim() : null;

  const input = {
    vendor:
      body.vendor === null
        ? null
        : typeof body.vendor === 'string'
          ? body.vendor
          : undefined,
    defaultModel: typeof body.defaultModel === 'string' ? body.defaultModel : undefined,
    temperature:
      typeof body.temperature === 'number'
        ? body.temperature
        : body.temperature === null
          ? null
          : undefined,
    maxTokens:
      typeof body.maxTokens === 'number'
        ? body.maxTokens
        : body.maxTokens === null
          ? null
          : undefined,
    enableTools: typeof body.enableTools === 'boolean' ? body.enableTools : undefined,
    enablePrompts: typeof body.enablePrompts === 'boolean' ? body.enablePrompts : undefined,
    maxToolCallRounds:
      typeof body.maxToolCallRounds === 'number' ? body.maxToolCallRounds : undefined,
    permissionMode:
      body.permissionMode === 'open'
        ? ('open' as const)
        : body.permissionMode === 'locked'
          ? ('locked' as const)
          : undefined,
    enableAutoCompact:
      typeof body.enableAutoCompact === 'boolean' ? body.enableAutoCompact : undefined,
    compactModel:
      body.compactModel === null
        ? null
        : typeof body.compactModel === 'string'
          ? body.compactModel
          : undefined,
    mcpServerIds: parseStringArray(body.mcpServerIds),
    toolPrompt:
      body.toolPrompt === null
        ? null
        : typeof body.toolPrompt === 'string'
          ? body.toolPrompt
          : undefined,
  };

  try {
    const result = await saveChannelConfig({ channel, boundUserId, input });
    const payload: Record<string, unknown> = { profile: result.profile };
    if (result.skippedMcpServers.length > 0) {
      payload.skippedMcpServers = result.skippedMcpServers;
    }
    reloadConfigPlaneSnapshot();
    return Response.json({ success: true, ...payload });
  } catch (error: unknown) {
    return adminError(500, '保存渠道配置失败', getErrorMessage(error));
  }
}

export async function handleAdminSeed(): Promise<Response> {
  try {
    const result = await runConfigPlaneSeed();
    const didWrite =
      result.seededEmpty || result.createdProfiles > 0 || result.createdRoutes > 0;
    let message = '无需初始化，默认方案已存在';
    if (result.seededEmpty) {
      message = '空库初始化完成';
    } else if (didWrite) {
      message = `已补齐 ${result.createdProfiles} 个方案、${result.createdRoutes} 条路由`;
    }
    if (didWrite) {
      reloadConfigPlaneSnapshot();
    }
    return Response.json({ success: true, message, ...result });
  } catch (error: unknown) {
    return adminError(500, 'seed 失败', getErrorMessage(error));
  }
}
