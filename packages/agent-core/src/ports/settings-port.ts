export interface McpConfig {
  enabledToolServerIds: string[];
}

let toolPromptSetting = '';
let mcpConfig: McpConfig = { enabledToolServerIds: [] };

export function setToolPromptSetting(value: string): void {
  toolPromptSetting = value;
}

export function setMcpConfig(next: McpConfig): void {
  mcpConfig = next;
}

export async function getSetting(key: string): Promise<unknown> {
  if (key === 'mcpToolPrompt') {
    return toolPromptSetting;
  }
  return undefined;
}

export async function getMCPConfig(_userId?: string): Promise<McpConfig> {
  return mcpConfig;
}
