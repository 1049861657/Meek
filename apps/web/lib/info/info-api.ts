import { FetchJsonError } from '@/lib/api/fetch-json';
import type { InfoData } from '@/lib/info/types';

function formatApiError(
  body: { error?: string; details?: string },
  status: number,
  fallback: string,
): string {
  const error = body.error?.trim();
  const details = body.details?.trim();
  const parts: string[] = [];

  if (error) {
    parts.push(error);
  }
  if (details && details !== error) {
    parts.push(details);
  }

  if (parts.length > 0) {
    return parts.join('：');
  }

  return status >= 400 ? `${fallback}（HTTP ${status}）` : fallback;
}

export async function requestInfoJson(
  url: string,
  init?: RequestInit,
): Promise<unknown> {
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string; details?: string };
      message = formatApiError(body, response.status, message);
    } catch {
      /* ignore */
    }
    throw new FetchJsonError(message, response.status);
  }

  return response.json();
}

export async function fetchInfoData(): Promise<InfoData> {
  return (await requestInfoJson('/api/info')) as InfoData;
}

export async function reloadServerConfig(): Promise<InfoData> {
  return (await requestInfoJson('/api/server/reload-config', {
    method: 'POST',
  })) as InfoData;
}

export async function switchServer(serverId: string): Promise<InfoData> {
  return (await requestInfoJson(`/api/server/switch/${encodeURIComponent(serverId)}`, {
    method: 'POST',
  })) as InfoData;
}

export async function connectServer(serverId: string): Promise<InfoData> {
  return (await requestInfoJson(`/api/server/connect/${encodeURIComponent(serverId)}`, {
    method: 'POST',
  })) as InfoData;
}

export async function disconnectServer(serverId: string): Promise<InfoData> {
  return (await requestInfoJson(`/api/server/disconnect/${encodeURIComponent(serverId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })) as InfoData;
}

export async function addServer(body: Record<string, unknown>): Promise<InfoData> {
  return (await requestInfoJson('/api/server/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })) as InfoData;
}

export async function updateServer(
  serverId: string,
  body: Record<string, unknown>,
): Promise<InfoData> {
  return (await requestInfoJson(`/api/server/update/${encodeURIComponent(serverId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })) as InfoData;
}

export async function deleteServerApi(serverId: string): Promise<InfoData> {
  return (await requestInfoJson(`/api/server/delete/${encodeURIComponent(serverId)}`, {
    method: 'DELETE',
  })) as InfoData;
}

export async function saveToolPreferences(
  serverId: string,
  preferences: Record<string, boolean>,
): Promise<void> {
  await requestInfoJson(`/api/server/${encodeURIComponent(serverId)}/tool-preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences }),
  });
}

export async function startOAuthAuthorization(serverId: string): Promise<string> {
  const data = (await requestInfoJson(
    `/api/server/${encodeURIComponent(serverId)}/oauth/authorize`,
  )) as { authorizationUrl?: string };

  if (!data.authorizationUrl) {
    throw new Error('未返回授权 URL');
  }

  return data.authorizationUrl;
}
