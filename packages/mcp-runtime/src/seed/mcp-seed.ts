import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Logger } from '@meek/agent-core';
import { ConnectionType, prisma } from '@meek/db';

import type { MCPServer } from '../types/mcp-config.types.js';

import { invalidateMcpConfigCache } from '../services/mcp-config.store.js';

const PKG_SRC_DIR = path.dirname(fileURLToPath(import.meta.url));
const MONOREPO_ROOT = path.resolve(PKG_SRC_DIR, '../../../..');
const WORKER_MCP_DIR = path.join(MONOREPO_ROOT, 'apps/worker/mcp-servers');

function stdioArgs(scriptFile: string): string[] {
  return ['--import', 'tsx/esm', path.join(WORKER_MCP_DIR, scriptFile)];
}

/** seed 基线 MCP 服（userId=null）；stdio 路径对齐 apps/worker/mcp-servers（M2-06 落盘） */
export const MCP_SEED_SERVERS: MCPServer[] = [
  {
    serverId: 'echo-mcp',
    name: 'Echo',
    enabled: false,
    connectionType: ConnectionType.STDIO,
    command: process.execPath,
    args: stdioArgs('echo-mcp.ts'),
  },
  {
    serverId: 'large-json-mcp',
    name: 'Large JSON',
    enabled: false,
    connectionType: ConnectionType.STDIO,
    command: process.execPath,
    args: stdioArgs('large-json-mcp.ts'),
  },
  {
    serverId: 'product-list-mcp',
    name: 'Product List',
    enabled: false,
    connectionType: ConnectionType.STDIO,
    command: process.execPath,
    args: stdioArgs('product-list-mcp.ts'),
  },
];

export type McpSeedResult = {
  seededServers: boolean;
  seededToolPrompt: boolean;
};

/** 空库写入 MCP seed 基线（userId=null）；已存在则跳过 */
export async function seedMcpBaselineIfEmpty(): Promise<McpSeedResult> {
  let seededServers = false;
  let seededToolPrompt = false;

  const serverCount = await prisma.mCPServer.count({ where: { userId: null } });
  if (serverCount === 0) {
    for (const server of MCP_SEED_SERVERS) {
      await prisma.mCPServer.create({
        data: {
          userId: null,
          serverId: server.serverId,
          name: server.name,
          enabled: server.enabled,
          connectionType: server.connectionType,
          command: server.command,
          args: server.args as never,
          mcpUrl: server.mcpUrl,
          headers: server.headers as never,
        },
      });
    }
    seededServers = true;
    invalidateMcpConfigCache();
    Logger.info('MCP SEED', `写入 seed MCP 服务器 ${MCP_SEED_SERVERS.length} 条`);
  }

  const toolPromptRow = await prisma.setting.findFirst({
    where: { userId: null, key: 'mcpToolPrompt' },
  });
  if (!toolPromptRow) {
    await prisma.setting.create({
      data: { userId: null, key: 'mcpToolPrompt', value: '' as never },
    });
    seededToolPrompt = true;
    invalidateMcpConfigCache();
    Logger.info('MCP SEED', '写入 seed mcpToolPrompt 空串');
  }

  return { seededServers, seededToolPrompt };
}
