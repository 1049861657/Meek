import { prisma } from '@meek/db';
import type { ChannelId } from '@meek/shared';

import type { ConfigPlaneSnapshot } from './config-snapshot.js';
import { invalidateChannelSnapshot, resolveChannelSnapshot } from './config-snapshot.js';
import type { AgentProfileRecord, RouteRuleRecord } from './config-plane.types.js';
import {
  CHANNEL_DEFAULT_PROFILE_BY_CHANNEL,
  ROUTE_MATCH_ALL,
} from './config-plane.types.js';
import { selectRouteRule } from './profile-resolver.js';
import { resolveConfigUserId } from './seed-follow.service.js';

export interface ChannelBindingContext {
  channel: ChannelId;
  wildcardRoute: RouteRuleRecord | null;
  profile: AgentProfileRecord;
  profileId: string;
  boundUserId: string | null;
  configUserId: string | null;
}

export function getWildcardRouteRule(
  snapshot: ConfigPlaneSnapshot,
  channel: ChannelId
): RouteRuleRecord | undefined {
  const routes = snapshot.routesByChannel.get(channel) ?? [];
  return selectRouteRule(channel, ROUTE_MATCH_ALL, routes);
}

export async function resolveChannelBindingContext(options: {
  channel: ChannelId;
  boundUserId?: string | null;
}): Promise<ChannelBindingContext> {
  const snapshot = await resolveChannelSnapshot();
  const wildcardRoute = getWildcardRouteRule(snapshot, options.channel) ?? null;

  const profileId =
    wildcardRoute?.profileId ?? CHANNEL_DEFAULT_PROFILE_BY_CHANNEL[options.channel];
  const profile = snapshot.profiles.get(profileId);
  if (!profile) {
    throw new Error(
      `Config plane: AgentProfile "${profileId}" missing for channel "${options.channel}". ` +
        'Initialize defaults via POST /api/admin/seed.'
    );
  }

  const boundUserId =
    options.boundUserId !== undefined
      ? options.boundUserId
      : (wildcardRoute?.boundUserId ?? null);
  const configUserId = await resolveConfigUserId({ boundUserId });

  return {
    channel: options.channel,
    wildcardRoute,
    profile,
    profileId,
    boundUserId,
    configUserId,
  };
}

/** 保存 IM 渠道通配路由 boundUserId（Admin「保存绑定」） */
export async function saveWildcardChannelBinding(options: {
  channel: 'dingtalk' | 'feishu';
  boundUserId: string;
}): Promise<ChannelBindingContext> {
  const boundUserId = options.boundUserId.trim();
  if (!boundUserId) {
    throw new Error('boundUserId 不能为空');
  }

  const snapshot = await resolveChannelSnapshot();
  const wildcardRoute = getWildcardRouteRule(snapshot, options.channel);
  if (!wildcardRoute) {
    throw new Error(`渠道 ${options.channel} 无通配路由，请先执行 seed`);
  }

  await prisma.routeRule.update({
    where: { id: wildcardRoute.id },
    data: { boundUserId },
  });
  invalidateChannelSnapshot();

  return resolveChannelBindingContext({ channel: options.channel });
}
