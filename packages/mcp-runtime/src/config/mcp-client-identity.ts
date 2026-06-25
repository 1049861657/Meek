import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { findMonorepoRoot } from '@meek/shared/root-env';
import type { ClientCapabilities } from '@modelcontextprotocol/sdk/types.js';

const monorepoRoot = findMonorepoRoot(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(
  readFileSync(path.join(monorepoRoot, 'package.json'), 'utf8')
) as { name: string; version: string };

export function parseMcpClientRootPathsFromEnv(): string[] {
  const raw = process.env.MCP_CLIENT_ROOTS?.trim();
  if (!raw) {
    return [];
  }
  return raw
    .split(/[;,]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

export function buildMcpClientCapabilities(): ClientCapabilities {
  const capabilities: ClientCapabilities = {
    sampling: {},
  };
  if (parseMcpClientRootPathsFromEnv().length > 0) {
    capabilities.roots = { listChanged: false };
  }
  return capabilities;
}

/** MCP SDK Client 握手身份（name/version 来自 monorepo 根 package.json） */
export const MCPClientIdentity = {
  name: pkg.name,
  version: pkg.version,
  capabilities: buildMcpClientCapabilities(),
};
