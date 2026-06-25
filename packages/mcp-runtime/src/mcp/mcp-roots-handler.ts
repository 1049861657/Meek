import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

/**
 * 注册 roots/list 处理器；仅在已声明 roots 能力且 MCP_CLIENT_ROOTS 非空时调用。
 */
export function attachMcpRootsHandler(client: Client, rootPaths: readonly string[]): void {
  if (rootPaths.length === 0) {
    return;
  }

  const roots = rootPaths.map((dir) => {
    const resolved = path.resolve(dir);
    return {
      uri: pathToFileURL(resolved).href,
      name: path.basename(resolved),
    };
  });

  client.setRequestHandler(ListRootsRequestSchema, async () => ({ roots }));
}
