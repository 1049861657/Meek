import { prisma } from '@meek/db';

import type { McpToolPreferencesStore } from '../types/tool-preferences.types.js';

const SETTING_KEY = 'mcpToolPreferences';

function isPreferencesStore(value: unknown): value is McpToolPreferencesStore {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** per-server 工具偏好持久化（读写 only；启用语义见 ToolPolicyService） */
export class ToolPreferencesService {
  static async getAll(): Promise<McpToolPreferencesStore> {
    const row = await prisma.setting.findFirst({
      where: { userId: null, key: SETTING_KEY },
    });
    if (!row?.value || !isPreferencesStore(row.value)) {
      return {};
    }
    return row.value;
  }

  static async getForServer(serverId: string): Promise<Record<string, boolean>> {
    const all = await this.getAll();
    return { ...(all[serverId] ?? {}) };
  }

  static async saveForServer(
    serverId: string,
    preferences: Record<string, boolean>
  ): Promise<void> {
    const all = await this.getAll();
    all[serverId] = { ...preferences };
    const existing = await prisma.setting.findFirst({
      where: { userId: null, key: SETTING_KEY },
    });
    if (existing) {
      await prisma.setting.update({
        where: { id: existing.id },
        data: { value: all as never },
      });
    } else {
      await prisma.setting.create({
        data: { key: SETTING_KEY, value: all as never, userId: null },
      });
    }
  }
}
