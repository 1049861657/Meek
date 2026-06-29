/**
 * 配置服务：DB Setting / AIProvider 读写单入口。
 * MCP 配置委托 @meek/mcp-runtime；静态默认值仍来自 agent-core feature-config。
 */
import { prisma, ProviderType } from '@meek/db';
import type { AIProviderConfig, AIProvidersConfigType } from '@meek/agent-core/provider';
import { McpConfigService } from '@meek/mcp-runtime';
import type { MCPConfigType } from '@meek/mcp-runtime';

import { logError, logInfo } from './logger.js';

export class ConfigService {
  static async getSetting(key: string, userId?: string): Promise<unknown | null> {
    try {
      if (userId) {
        const userRow = await prisma.setting.findFirst({ where: { userId, key } });
        if (userRow !== null) {
          return userRow.value ?? null;
        }
        return null;
      }
      const seedRow = await prisma.setting.findFirst({ where: { userId: null, key } });
      return seedRow?.value ?? null;
    } catch (error) {
      logError('ConfigService', `获取设置失败 [${key}]:`, error);
      throw error;
    }
  }

  static async saveSetting(key: string, value: unknown, userId?: string): Promise<boolean> {
    const resolvedUserId = userId ?? null;
    try {
      const existing = await prisma.setting.findFirst({
        where: { userId: resolvedUserId, key },
      });
      if (existing) {
        await prisma.setting.update({
          where: { id: existing.id },
          data: { value: value as never },
        });
      } else {
        await prisma.setting.create({
          data: { key, value: value as never, userId: resolvedUserId },
        });
      }
      return true;
    } catch (error) {
      logError('ConfigService', `保存设置失败 [${key}]:`, error);
      throw error;
    }
  }

  static async resetSetting(key: string, userId: string): Promise<void> {
    await prisma.setting.deleteMany({ where: { userId, key } });
  }

  private static async hasProviderOverride(userId: string): Promise<boolean> {
    const tombstone = await prisma.setting.findFirst({
      where: { userId, key: 'defaultProvider' },
    });
    return tombstone !== null;
  }

  static async getAllProviders(userId?: string): Promise<AIProviderConfig[]> {
    try {
      let rows: Awaited<
        ReturnType<typeof prisma.aIProvider.findMany<{ include: { models: true } }>>
      >;
      if (userId) {
        if (await ConfigService.hasProviderOverride(userId)) {
          rows = await prisma.aIProvider.findMany({
            where: { userId },
            include: { models: true },
          });
        } else {
          return [];
        }
      } else {
        rows = await prisma.aIProvider.findMany({
          where: { userId: null },
          include: { models: true },
        });
      }

      if (rows.length === 0) {
        logInfo('ConfigService', '数据库中没有AI提供商配置，返回空数组');
        return [];
      }

      return rows.map((provider) => ({
        name: provider.name,
        type: provider.type as ProviderType,
        apiUrl: provider.apiUrl,
        apiKey: provider.apiKey,
        defaultModel: provider.defaultModel,
        models: provider.models.map((model) => ({
          value: model.value,
          label: model.label,
        })),
      }));
    } catch (error) {
      logError('ConfigService', '获取所有提供商失败:', error);
      throw error;
    }
  }

  static async getAIProvidersConfig(userId?: string): Promise<AIProvidersConfigType> {
    try {
      const providers = await ConfigService.getAllProviders(userId);
      const defaultProviderName = await ConfigService.getSetting('defaultProvider', userId);
      return {
        providers,
        defaultProvider: defaultProviderName as string | null,
      };
    } catch (error) {
      logError('ConfigService', '获取AI提供商配置失败:', error);
      throw error;
    }
  }

  static async saveAIProvidersConfig(
    config: AIProvidersConfigType,
    userId?: string
  ): Promise<boolean> {
    const resolvedUserId = userId ?? null;
    try {
      await ConfigService.saveSetting('defaultProvider', config.defaultProvider, userId);
      await prisma.aIProvider.deleteMany({ where: { userId: resolvedUserId } });

      for (const provider of config.providers) {
        await prisma.aIProvider.create({
          data: {
            userId: resolvedUserId,
            name: provider.name,
            type: provider.type as ProviderType,
            apiUrl: provider.apiUrl,
            apiKey: provider.apiKey,
            defaultModel: provider.defaultModel,
            models: {
              create: provider.models.map((model) => ({
                value: model.value,
                label: model.label,
              })),
            },
          },
        });
      }

      logInfo('ConfigService', `AI提供商配置已保存 userId=${resolvedUserId}`);
      return true;
    } catch (error) {
      logError('ConfigService', '保存AI提供商配置失败:', error);
      throw error;
    }
  }

  static async resetAIProvidersConfig(userId: string): Promise<void> {
    await prisma.aIProvider.deleteMany({ where: { userId } });
    await ConfigService.resetSetting('defaultProvider', userId);
  }

  static async getMCPConfig(userId?: string): Promise<MCPConfigType> {
    return McpConfigService.getMCPConfig(userId);
  }

  static async listConfiguredMcpServers(
    userId?: string
  ): Promise<Array<{ serverId: string; name: string }>> {
    return McpConfigService.listConfiguredMcpServers(userId);
  }

  static async saveMCPConfig(config: MCPConfigType, userId?: string): Promise<boolean> {
    await McpConfigService.saveMCPConfig(config, userId);
    return true;
  }

  static async resetMCPConfig(userId: string): Promise<void> {
    await McpConfigService.resetMCPConfig(userId);
  }
}
