/**
 * MCP 运行时连接意图（SSOT）。
 * - account-default：Info 页 / DB enabled 的账号默认连接
 * - chat-ephemeral：Web/IM 聊天按需连接；账号未 enabled 的服轮次结束释放
 * - admin-probe：Admin 保存门禁探测
 */
export type McpConnectMode = 'account-default' | 'chat-ephemeral' | 'admin-probe';

export interface McpEnsureOptions {
  mode?: McpConnectMode;
  chatRequestId?: string;
}

/** MCP 单服连接状态机（stdio 无 needs-auth） */
export type McpConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'needs-auth'
  | 'failed';

export const McpConnectionStatus = {
  Disconnected: 'disconnected',
  Connecting: 'connecting',
  Connected: 'connected',
  NeedsAuth: 'needs-auth',
  Failed: 'failed',
} as const satisfies Record<string, McpConnectionStatus>;

export function isMcpConnected(status: McpConnectionStatus): boolean {
  return status === McpConnectionStatus.Connected;
}
