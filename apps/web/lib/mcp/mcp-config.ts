import {
  setMcpConfig,
  setToolPromptSetting,
  type McpConfig,
} from '@meek/agent-core';
import { McpConfigService, type MCPConfigType } from '@meek/mcp-runtime';

function toPortConfig(config: MCPConfigType): McpConfig {
  const enabledToolServerIds = config.servers
    .filter((server) => server.enabled)
    .map((server) => server.serverId);
  return { enabledToolServerIds };
}

/** Web BFF：按 configUserId 加载 MCP 配置到 agent-core 端口 */
export async function loadMcpConfig(configUserId: string | null): Promise<MCPConfigType> {
  const config = await McpConfigService.getMCPConfig(configUserId ?? undefined);
  setMcpConfig(toPortConfig(config));
  setToolPromptSetting(config.toolPrompt);
  return config;
}
