import {
  buildAssembledSystemPreview,
  buildSystemPromptSectionPreviews,
  ToolsConfig,
  type PromptPipelineOptions,
} from '@meek/agent-core';
import { ConfigService } from '@meek/config-plane';
import type { AIProvidersConfigType } from '@meek/agent-core/provider';

import { loadAiProvidersConfig } from '@/lib/ai/provider-config';
import type { RequestPrincipal } from '@/lib/chat/resolve-principal';
import { loadMcpConfig } from '@/lib/mcp/mcp-config';
import { workerMcpReloadConfig } from '@/lib/worker/worker-client';

import { PROVIDER_TYPES } from './provider-types';

function settingsError(status: number, error: string, details?: string): Response {
  return Response.json(details ? { error, details } : { error }, { status });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeProvidersResponse(
  config: AIProvidersConfigType | null,
): { providers: AIProvidersConfigType['providers']; defaultProvider: string } {
  if (!config) {
    return { providers: [], defaultProvider: '' };
  }
  return {
    providers: config.providers,
    defaultProvider: config.defaultProvider ?? '',
  };
}

export async function handleGetProviders(principal: RequestPrincipal): Promise<Response> {
  try {
    const config = await ConfigService.getAIProvidersConfig(principal.configUserId ?? undefined);
    return Response.json(normalizeProvidersResponse(config));
  } catch (error: unknown) {
    return settingsError(500, '获取配置失败', getErrorMessage(error));
  }
}

export function handleGetProviderTypes(): Response {
  return Response.json(PROVIDER_TYPES, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}

export async function handleUpdateProviders(userId: string, body: unknown): Promise<Response> {
  const config = body as { providers?: unknown; defaultProvider?: unknown };
  if (!config || !Array.isArray(config.providers)) {
    return settingsError(400, '无效的提供商配置');
  }
  try {
    const payload: AIProvidersConfigType = {
      providers: config.providers as AIProvidersConfigType['providers'],
      defaultProvider:
        typeof config.defaultProvider === 'string' ? config.defaultProvider : null,
    };
    const success = await ConfigService.saveAIProvidersConfig(payload, userId);
    if (!success) {
      throw new Error('保存配置失败');
    }
    await loadAiProvidersConfig(userId);
    console.info(`[SETTINGS] 已更新 AI 提供商配置 userId=${userId}`);
    return Response.json({ success: true, message: '提供商配置已更新' });
  } catch (error: unknown) {
    return settingsError(500, '更新配置失败', getErrorMessage(error));
  }
}

export async function handleResetProviders(userId: string): Promise<Response> {
  try {
    await ConfigService.resetAIProvidersConfig(userId);
    await loadAiProvidersConfig(userId);
    console.info(`[SETTINGS] 已重置 AI 提供商配置 userId=${userId}`);
    return Response.json({ success: true, message: '已恢复为默认提供商配置' });
  } catch (error: unknown) {
    return settingsError(500, '重置失败', getErrorMessage(error));
  }
}

export async function handleReloadProviders(userId: string): Promise<Response> {
  try {
    const config = await loadAiProvidersConfig(userId);
    const defaultName =
      (config.defaultProvider ?? '').trim() || (config.providers?.[0]?.name ?? '');
    return Response.json({
      success: true,
      message: '提供商配置已重新加载并应用',
      providers: config.providers.map((provider) => provider.name),
      default: defaultName,
    });
  } catch (error: unknown) {
    return settingsError(500, '重新加载配置失败', getErrorMessage(error));
  }
}

export async function handleResetMcpServers(userId: string): Promise<Response> {
  try {
    await ConfigService.resetMCPConfig(userId);
    const reload = await workerMcpReloadConfig(userId);
    if (!reload.ok) {
      throw new Error(reload.error);
    }
    console.info(`[SETTINGS] 已重置 MCP 服务器配置 userId=${userId}`);
    return Response.json({ success: true, message: '已恢复为默认MCP服务器配置' });
  } catch (error: unknown) {
    return settingsError(500, '重置失败', getErrorMessage(error));
  }
}

export async function handleGetToolPrompt(principal: RequestPrincipal): Promise<Response> {
  try {
    const prompt = await ConfigService.getSetting(
      'mcpToolPrompt',
      principal.configUserId ?? undefined,
    );
    return Response.json({ success: true, prompt });
  } catch (error: unknown) {
    return settingsError(500, getErrorMessage(error));
  }
}

export async function handleSaveToolPrompt(userId: string, body: unknown): Promise<Response> {
  const prompt = (body as { prompt?: unknown })?.prompt;
  if (typeof prompt !== 'string') {
    return settingsError(400, '提示词必须是字符串');
  }
  try {
    await ConfigService.saveSetting('mcpToolPrompt', prompt, userId);
    console.info(`[SETTINGS] 工具提示词保存成功 userId=${userId}`);
    return Response.json({ success: true, message: '工具提示词保存成功' });
  } catch (error: unknown) {
    return settingsError(500, getErrorMessage(error));
  }
}

export async function handleResetToolPrompt(userId: string): Promise<Response> {
  try {
    await ConfigService.resetSetting('mcpToolPrompt', userId);
    return Response.json({ success: true, message: '已恢复为默认工具提示词' });
  } catch (error: unknown) {
    return settingsError(500, getErrorMessage(error));
  }
}

export async function handleGetSystemPromptSections(
  principal: RequestPrincipal,
  searchParams: URLSearchParams,
): Promise<Response> {
  try {
    const enableTools = searchParams.get('enableTools') !== 'false';
    const enablePrompts =
      searchParams.get('enablePrompts') !== 'false' && ToolsConfig.enablePrompts;
    const mcpServerIdsRaw = searchParams.get('mcpServerIds');
    const mcpServerIds =
      typeof mcpServerIdsRaw === 'string' && mcpServerIdsRaw.length > 0
        ? mcpServerIdsRaw
            .split(',')
            .map((segment) => segment.trim())
            .filter(Boolean)
        : undefined;
    const toolPromptOverride =
      typeof searchParams.get('toolPrompt') === 'string'
        ? (searchParams.get('toolPrompt') ?? undefined)
        : undefined;
    const storedToolPrompt = String(
      (await ConfigService.getSetting(
        'mcpToolPrompt',
        principal.configUserId ?? undefined,
      )) ?? '',
    );

    await loadMcpConfig(principal.configUserId);

    const options: PromptPipelineOptions = {
      enableTools,
      enablePrompts,
      toolPromptOverride,
      includeMemory: false,
      resolvedProfile:
        mcpServerIds && mcpServerIds.length > 0
          ? {
              profileId: 'preview',
              enableTools: true,
              enablePrompts,
              maxToolCallRounds: ToolsConfig.maxToolCallRounds,
              enableAutoCompact: false,
              model: '',
              temperature: 0,
              maxTokens: 0,
              mcpServerIds,
              toolPrompt: toolPromptOverride ?? storedToolPrompt,
              permissionMode: 'open',
              configUserId: principal.configUserId ?? null,
            }
          : undefined,
    };

    const [sections, assembled] = await Promise.all([
      buildSystemPromptSectionPreviews(options),
      buildAssembledSystemPreview(options),
    ]);
    return Response.json({ success: true, sections, assembled });
  } catch (error: unknown) {
    return settingsError(500, '获取分段预览失败', getErrorMessage(error));
  }
}
