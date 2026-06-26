import { ConfigService } from '@meek/config-plane';
import {
  getProviderForUser,
  initializeProviders,
  invalidateProviderCache,
  setAiProvidersConfig,
  setMcpClientResolver,
  type AIProvider,
  type AIProvidersConfigType,
} from '@meek/agent-core';
import { getMcpClientForUser as getRuntimeMcpClient } from '@meek/mcp-runtime';

import { bootstrapMcpConfig, loadMcpConfig } from './mcp-config-bootstrap.js';
import { createMcpClientPort } from './mcp-adapter.js';
import { wireMcpConnectionService } from './mcp-connection-bridge.js';

export async function loadAiProvidersConfig(
  configUserId: string | null
): Promise<AIProvidersConfigType> {
  const config = await ConfigService.getAIProvidersConfig(configUserId ?? undefined);
  setAiProvidersConfig(config);
  return config;
}

export async function resolveDefaultModel(configUserId: string | null): Promise<string> {
  const config = await loadAiProvidersConfig(configUserId);
  const defaultName =
    (config.defaultProvider ?? '').trim() || (config.providers?.[0]?.name ?? '');
  const provider =
    config.providers?.find((item) => item.name === defaultName) ?? config.providers?.[0];
  return provider?.defaultModel ?? 'gpt-4o-mini';
}

let workerRuntimeInitialized = false;

export async function ensureWorkerRuntime(configUserId: string | null = null): Promise<void> {
  if (workerRuntimeInitialized) {
    return;
  }
  await bootstrapMcpConfig();
  setMcpClientResolver((userId) => createMcpClientPort(getRuntimeMcpClient(userId)));
  wireMcpConnectionService();
  await loadAiProvidersConfig(configUserId);
  await initializeProviders();
  workerRuntimeInitialized = true;
}

export async function ensureWorkerRuntimeForUser(configUserId: string | null): Promise<void> {
  await ensureWorkerRuntime(configUserId);
  await loadMcpConfig(configUserId);
  await loadAiProvidersConfig(configUserId);
  invalidateProviderCache(configUserId ?? undefined);
}

export async function getHarnessProvider(
  configUserId: string | null,
  vendor?: string
): Promise<Awaited<ReturnType<typeof getProviderForUser>>> {
  await ensureWorkerRuntimeForUser(configUserId);
  return getProviderForUser(configUserId, vendor);
}
