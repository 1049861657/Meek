export const MCP_STATUS = {
  Connected: 'connected',
  Disconnected: 'disconnected',
  Connecting: 'connecting',
  NeedsAuth: 'needs-auth',
  Failed: 'failed',
} as const;

export type McpStatus = (typeof MCP_STATUS)[keyof typeof MCP_STATUS];

export function isServerConnected(status: string): boolean {
  return status === MCP_STATUS.Connected;
}

export function serverStatusLabel(status: string): string {
  switch (status) {
    case MCP_STATUS.Connected:
      return '已连接';
    case MCP_STATUS.Connecting:
      return '连接中';
    case MCP_STATUS.NeedsAuth:
      return '需授权';
    case MCP_STATUS.Failed:
      return '连接失败';
    default:
      return '未连接';
  }
}

export function serverStatusChipVariant(
  status: string,
): 'on' | 'off' | 'pending' | 'warn' | 'err' {
  if (status === MCP_STATUS.Connected) {
    return 'on';
  }
  if (status === MCP_STATUS.Connecting) {
    return 'pending';
  }
  if (status === MCP_STATUS.NeedsAuth) {
    return 'warn';
  }
  if (status === MCP_STATUS.Failed) {
    return 'err';
  }
  return 'off';
}
