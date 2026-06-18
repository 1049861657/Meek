import {
  getMcpClientForUser,
  McpConfigService,
  McpServerAuthService,
  setMcpOAuthRedirectOrigin,
  clearMcpOAuthRedirectOrigin,
} from '@meek/mcp-runtime';

import { ensureWorkerRuntimeForUser } from './runtime-bootstrap.js';

export type McpOAuthAuthorizeResult = {
  authorizationUrl: string;
};

export type McpOAuthFinishResult = {
  serverId: string;
};

function resolveServerIdFromState(state: string, oauthCtx: { serverId: string } | null): string {
  const fromCtx = oauthCtx?.serverId;
  if (fromCtx) {
    return fromCtx;
  }
  const fromState = state.split(':')[0]?.trim();
  if (!fromState) {
    throw new Error('无法解析 serverId');
  }
  return fromState;
}

/** 触发 OAuth 连接并返回待打开的授权 URL（stdio 仅在 worker 执行） */
export async function handleMcpOAuthAuthorize(
  configUserId: string | null,
  serverId: string,
  webOrigin?: string
): Promise<McpOAuthAuthorizeResult> {
  if (webOrigin) {
    setMcpOAuthRedirectOrigin(webOrigin);
  }
  try {
    await ensureWorkerRuntimeForUser(configUserId);
    const client = getMcpClientForUser(configUserId);
    await client.ensureReady();

    let authorizationUrl = client.getOAuthAuthorizationUrl(serverId);
    if (!authorizationUrl) {
      await client.connect(serverId);
      authorizationUrl = client.getOAuthAuthorizationUrl(serverId);
    }

    if (!authorizationUrl) {
      throw new Error('无法获取授权 URL：请先确认该远程服需要 OAuth 且可连接');
    }

    return { authorizationUrl };
  } finally {
    clearMcpOAuthRedirectOrigin();
  }
}

/** OAuth 回调：交换 code、持久化 token 并重连 MCP 服 */
export async function handleMcpOAuthFinish(code: string, state: string): Promise<McpOAuthFinishResult> {
  const oauthCtx = await McpServerAuthService.findOAuthContextByState(state);
  const serverId = resolveServerIdFromState(state, oauthCtx ?? null);
  const configUserId = oauthCtx?.userId ?? null;

  const config = await McpConfigService.getMCPConfig(configUserId ?? undefined);
  const serverConfig = config.servers.find((server) => server.serverId === serverId);
  if (!serverConfig?.mcpUrl) {
    throw new Error(`服务器不存在或无 mcpUrl: ${serverId}`);
  }

  await ensureWorkerRuntimeForUser(configUserId);
  const client = getMcpClientForUser(configUserId);
  await client.ensureReady();
  await client.finishOAuthAndConnect(serverId, code);

  return { serverId };
}
