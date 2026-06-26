import { fetchJson } from '@/lib/api/fetch-json';
import { assertAdminWriteReady } from './admin-api-gate';
import type {
  AdminUser,
  ChannelConfigSaveResult,
  ChannelConfigState,
  ChannelStatusMap,
  RouteRule,
  SeedFollow,
} from './types';

const ADMIN_API = '/api/admin';
const USERS_API = '/api/users';

async function adminJson(url: string, init?: RequestInit): Promise<unknown> {
  const headers = new Headers(init?.headers ?? {});
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetchJson(url, { ...init, headers });
}

export async function fetchAdminRoutes(): Promise<RouteRule[]> {
  const rows = (await adminJson(`${ADMIN_API}/routes`)) as RouteRule[];
  return Array.isArray(rows) ? rows : [];
}

export async function updateAdminRoute(
  routeId: string,
  body: { boundUserId: string },
): Promise<void> {
  assertAdminWriteReady();
  await adminJson(`${ADMIN_API}/routes/${encodeURIComponent(routeId)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function fetchChannelStatus(): Promise<ChannelStatusMap> {
  const status = (await adminJson(`${ADMIN_API}/channel-status`)) as Partial<ChannelStatusMap>;
  return {
    dingtalk: status?.dingtalk ?? 'skipped',
    feishu: status?.feishu ?? 'skipped',
  };
}

export async function fetchChannelConfig(
  channel: string,
  boundUserId: string | null,
): Promise<ChannelConfigState> {
  const qs = new URLSearchParams({ channel });
  if (boundUserId) {
    qs.set('boundUserId', boundUserId);
  }
  return (await adminJson(
    `${ADMIN_API}/channel-config?${qs.toString()}`,
  )) as ChannelConfigState;
}

export async function saveChannelConfig(body: {
  channel: string;
  boundUserId: string | null;
} & Record<string, unknown>): Promise<ChannelConfigSaveResult> {
  assertAdminWriteReady();
  return (await adminJson(`${ADMIN_API}/channel-config`, {
    method: 'PUT',
    body: JSON.stringify(body),
  })) as ChannelConfigSaveResult;
}

export async function postAdminSeed(): Promise<void> {
  assertAdminWriteReady();
  await adminJson(`${ADMIN_API}/seed`, { method: 'POST' });
}

export async function fetchUsers(): Promise<AdminUser[]> {
  const users = (await adminJson(USERS_API)) as AdminUser[];
  return Array.isArray(users) ? users : [];
}

export async function fetchSeedFollow(): Promise<SeedFollow> {
  const result = (await adminJson(`${USERS_API}/seed-follow`)) as SeedFollow;
  return {
    userId: result?.userId ?? null,
    username: result?.username ?? null,
  };
}

export async function saveSeedFollow(userId: string): Promise<SeedFollow> {
  assertAdminWriteReady();
  const result = (await adminJson(`${USERS_API}/seed-follow`, {
    method: 'PUT',
    body: JSON.stringify({ userId }),
  })) as { userId: string; username?: string | null };
  return {
    userId: result.userId,
    username: result.username ?? null,
  };
}

export async function setUserRole(userId: string, role: string): Promise<void> {
  assertAdminWriteReady();
  await adminJson(`${USERS_API}/${encodeURIComponent(userId)}/role`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}

export async function resetUserPassword(userId: string, password: string): Promise<void> {
  assertAdminWriteReady();
  await adminJson(`${USERS_API}/${encodeURIComponent(userId)}/reset-password`, {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}
