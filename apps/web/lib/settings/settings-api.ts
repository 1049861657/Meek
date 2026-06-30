import type { ProviderConnectivityStatus } from '@meek/connectivity';
import { FetchJsonError } from '@/lib/api/fetch-json';
import type { ProviderTypeOption, ProvidersData } from '@/lib/settings/types';

const FALLBACK_PROVIDER_TYPES: ProviderTypeOption[] = [{ value: 'openai', label: 'OpenAI' }];

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

export async function requestSettingsJson(
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

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export function getFallbackProviderTypes(): ProviderTypeOption[] {
  return FALLBACK_PROVIDER_TYPES;
}

export async function fetchProviderTypes(): Promise<ProviderTypeOption[]> {
  return (await requestSettingsJson('/api/settings/provider-types')) as ProviderTypeOption[];
}

export async function fetchProvidersData(): Promise<ProvidersData> {
  return (await requestSettingsJson('/api/settings/providers')) as ProvidersData;
}

export async function saveProvidersData(data: ProvidersData): Promise<void> {
  await requestSettingsJson('/api/settings/providers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function reloadProvidersConfig(): Promise<void> {
  await requestSettingsJson('/api/settings/providers/reload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

export type { ProviderConnectivityStatus } from '@meek/connectivity';

const PROBE_POLL_INTERVAL_MS = 500;
const PROBE_POLL_MAX_ATTEMPTS = 24;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function fetchProviderConnectivityStatus(): Promise<ProviderConnectivityStatus> {
  return (await requestSettingsJson('/api/settings/providers/status')) as ProviderConnectivityStatus;
}

export async function watchProviderConnectivity(
  onStatus: (status: ProviderConnectivityStatus) => void,
): Promise<ProviderConnectivityStatus | null> {
  for (let attempt = 0; attempt < PROBE_POLL_MAX_ATTEMPTS; attempt += 1) {
    const status = await fetchProviderConnectivityStatus();
    onStatus(status);
    if (status.state !== 'pending') {
      return status;
    }
    if (attempt < PROBE_POLL_MAX_ATTEMPTS - 1) {
      await sleep(PROBE_POLL_INTERVAL_MS);
    }
  }
  return null;
}
