import { workerMcpOAuthAuthorize, workerMcpOAuthFinish } from '@/lib/worker/worker-client';

export async function handleMcpOAuthAuthorize(
  configUserId: string,
  serverId: string,
  webOrigin: string
): Promise<{ authorizationUrl: string }> {
  const result = await workerMcpOAuthAuthorize(configUserId, serverId, webOrigin);
  return { authorizationUrl: result.authorizationUrl };
}

export async function handleMcpOAuthCallback(
  code: string,
  state: string
): Promise<{ serverId: string }> {
  return workerMcpOAuthFinish(code, state);
}
