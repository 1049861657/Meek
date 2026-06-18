import { prisma } from '@meek/db';

import type { MCPConfigType } from '../types/mcp-config.types.js';

import { invalidateMcpConfigCache, McpConfigStore } from './mcp-config.store.js';

const MCP_TOOL_PROMPT_KEY = 'mcpToolPrompt';

/** MCP 配置 CRUD（Settings / Info / Admin 复用） */
export class McpConfigService {
  static async getMCPConfig(userId?: string): Promise<MCPConfigType> {
    return McpConfigStore.get(userId);
  }

  static async listConfiguredMcpServers(
    userId?: string
  ): Promise<Array<{ serverId: string; name: string }>> {
    const config = await McpConfigStore.get(userId);
    return config.servers
      .map((server) => ({ serverId: server.serverId, name: server.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  static async saveMCPConfig(config: MCPConfigType, userId?: string): Promise<void> {
    await McpConfigStore.saveFull(config, userId);
  }

  static async resetMCPConfig(userId: string): Promise<void> {
    await McpConfigStore.reset(userId);
  }

  static async getToolPrompt(userId?: string): Promise<string> {
    const config = await McpConfigStore.get(userId);
    return config.toolPrompt;
  }

  static async saveToolPrompt(prompt: string, userId?: string): Promise<void> {
    const resolvedUserId = userId ?? null;
    const existing = await prisma.setting.findFirst({
      where: { userId: resolvedUserId, key: MCP_TOOL_PROMPT_KEY },
    });
    if (existing) {
      await prisma.setting.update({
        where: { id: existing.id },
        data: { value: prompt as never },
      });
    } else {
      await prisma.setting.create({
        data: { key: MCP_TOOL_PROMPT_KEY, value: prompt as never, userId: resolvedUserId },
      });
    }
    invalidateMcpConfigCache(userId);
  }

  static async resetToolPrompt(userId: string): Promise<void> {
    await prisma.setting.deleteMany({ where: { userId, key: MCP_TOOL_PROMPT_KEY } });
    invalidateMcpConfigCache(userId);
  }

  static async setServerEnabled(
    userId: string,
    serverId: string,
    enabled: boolean
  ): Promise<void> {
    await McpConfigStore.setServerEnabled(userId, serverId, enabled);
  }
}
