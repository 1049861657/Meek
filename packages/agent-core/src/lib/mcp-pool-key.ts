import type { ResolvedProfile } from '@meek/shared';

export type McpPoolKeySource = Pick<ResolvedProfile, 'configUserId'>;

export function resolveMcpPoolKey(profile: McpPoolKeySource | undefined): string | null {
  return profile?.configUserId ?? null;
}
