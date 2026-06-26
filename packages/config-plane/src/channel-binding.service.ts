import type { ChannelId } from '@meek/shared';

import type { ConfigPlaneSnapshot } from './config-snapshot.js';
import { resolveChannelSnapshot } from './config-snapshot.js';
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
