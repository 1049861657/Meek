import { ConfigService } from '@meek/config-plane';
import {
  commitProviderConfig,
  forceCommitProviderConfig,
  getProviderForUser,
  initializeProviders,
  installMemoryPort,
  invalidateProviderCache,
  setChatStore,
  setMcpClientResolver,
  type AIProvider,
  type AIProvidersConfigType,
} from '@meek/agent-core';
import { chatStorePort } from '@meek/chat-store';
import { setMcpReachabilityPartitioner } from '@meek/config-plane';
import { getMcpClientForUser as getRuntimeMcpClient, McpReachabilityService } from '@meek/mcp-runtime';

import { bootstrapMcpConfig, loadMcpConfig } from './mcp-config-bootstrap.js';
import { createMcpClientPort } from './mcp-adapter.js';
import { wireMcpConnectionService } from './mcp-connection-bridge.js';

export async function syncAiProvidersConfigPort(
  configUserId: string | null,
): Promise<AIProvidersConfigType> {
  const config = await ConfigService.getAIProvidersConfig(configUserId ?? undefined);
  if (commitProviderConfig(configUserId, config)) {
    invalidateProviderCache(configUserId ?? undefined);
  }
  return config;
}

export async function applyAiProvidersConfigUpdate(
  configUserId: string | null,
): Promise<AIProvidersConfigType> {
  const config = await ConfigService.getAIProvidersConfig(configUserId ?? undefined);
  forceCommitProviderConfig(configUserId, config);
  invalidateProviderCache(configUserId ?? undefined);
  return config;
}

export async function resolveDefaultModel(configUserId: string | null): Promise<string> {
  const config = await syncAiProvidersConfigPort(configUserId);
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
  setChatStore(chatStorePort);
  installMemoryPort();
  await bootstrapMcpConfig();
  setMcpClientResolver((userId) => createMcpClientPort(getRuntimeMcpClient(userId)));
  setMcpReachabilityPartitioner((serverIds, configUserId, enableTools) =>
    McpReachabilityService.partitionForPersistence(serverIds, configUserId, enableTools)
  );
  wireMcpConnectionService();
  const seedConfig = await ConfigService.getAIProvidersConfig(undefined);
  forceCommitProviderConfig(null, seedConfig);
  await initializeProviders();
  workerRuntimeInitialized = true;
}

export async function ensureWorkerRuntimeForUser(configUserId: string | null): Promise<void> {
  await ensureWorkerRuntime(configUserId);
  await loadMcpConfig(configUserId);
  await syncAiProvidersConfigPort(configUserId);
}

export async function getHarnessProvider(
  configUserId: string | null,
  vendor?: string
): Promise<Awaited<ReturnType<typeof getProviderForUser>>> {
  await ensureWorkerRuntimeForUser(configUserId);
  return getProviderForUser(configUserId, vendor);
}
