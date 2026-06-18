/** MCP 连接池与工具列表缓存（对齐 MCP-Client feature-config McpPoolConfig） */
export const McpPoolConfig = {
  maxClients: 20,
  clientTtlMs: 30 * 60 * 1000,
  configCacheTtlMs: 60_000,
  configCacheMaxEntries: 128,
  toolsCacheTtlMs: 5 * 60 * 1000,
  reconnectIntervalMs: 8 * 60 * 60 * 1000,
} as const;
