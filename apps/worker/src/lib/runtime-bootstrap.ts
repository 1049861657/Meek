import { prisma } from '@meek/db';
import {
  getProviderForUser,
  initializeProviders,
  setAiProvidersConfig,
  setMcpClientResolver,
  type AIProvider,
  type AIProvidersConfigType,
} from '@meek/agent-core';
import { getMcpClientForUser as getRuntimeMcpClient } from '@meek/mcp-runtime';

import { bootstrapMcpConfig, loadMcpConfig } from './mcp-config-bootstrap.js';
import { createMcpClientPort } from './mcp-adapter.js';
import { wireMcpConnectionService } from './mcp-connection-bridge.js';

async function readDefaultProviderName(userId: string | null): Promise<string | null> {
  const row = await prisma.setting.findFirst({
    where: { userId, key: 'defaultProvider' },
  });
  if (!row?.value || typeof row.value !== 'string') {
    return null;
  }
  return row.value;
}

function mapProviderRow(row: {
  name: string;
  type: string;
  apiUrl: string;
  apiKey: string;
  defaultModel: string;
  models: { value: string; label: string }[];
}): AIProvider {
  return {
    name: row.name,
    type: row.type,
    apiUrl: row.apiUrl,
    apiKey: row.apiKey,
    defaultModel: row.defaultModel,
    models: row.models.map((model) => ({
      value: model.value,
      label: model.label,
    })),
  };
}

export async function loadAiProvidersConfig(
  configUserId: string | null
): Promise<AIProvidersConfigType> {
  const rows = await prisma.aIProvider.findMany({
    where: { userId: configUserId },
    include: { models: true },
  });
  const providers = rows.map(mapProviderRow);
  const defaultProvider = await readDefaultProviderName(configUserId);
  const config: AIProvidersConfigType = { providers, defaultProvider };
  setAiProvidersConfig(config);
  return config;
}

export async function resolveDefaultModel(configUserId: string | null): Promise<string> {
  const config = await loadAiProvidersConfig(configUserId);
  const defaultName =
    (config.defaultProvider ?? '').trim() || (config.providers?.[0]?.name ?? '');
  const provider = config.providers?.find((item) => item.name === defaultName)
    ?? config.providers?.[0];
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
}

export async function getHarnessProvider(
  configUserId: string | null,
  vendor?: string
): Promise<Awaited<ReturnType<typeof getProviderForUser>>> {
  await ensureWorkerRuntimeForUser(configUserId);
  return getProviderForUser(configUserId, vendor);
}
