import {
  setMcpConfig,
  setToolPreferencesStore,
  setToolPromptSetting,
  type McpConfig,
} from '@meek/agent-core';
import {
  McpConfigService,
  ToolPreferencesService,
  type MCPConfigType,
} from '@meek/mcp-runtime';

function toPortConfig(config: MCPConfigType): McpConfig {
  const enabledToolServerIds = config.servers
    .filter((server) => server.enabled)
    .map((server) => server.serverId);
  return { enabledToolServerIds };
}

/** 从 DB 加载 MCP 配置并注入 agent-core 端口 */
export async function loadMcpConfig(configUserId: string | null): Promise<MCPConfigType> {
  const config = await McpConfigService.getMCPConfig(configUserId ?? undefined);
  setMcpConfig(toPortConfig(config));
  setToolPromptSetting(config.toolPrompt);
  const toolPreferences = await ToolPreferencesService.getAll();
  setToolPreferencesStore(toolPreferences);
  return config;
}

/** Worker 启动：预热 guest MCP 配置 */
export async function bootstrapMcpConfig(): Promise<void> {
  await loadMcpConfig(null);
}
