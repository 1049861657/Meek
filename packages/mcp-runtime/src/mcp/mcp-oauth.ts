import { randomBytes } from 'node:crypto';

import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type {
  OAuthClientProvider,
  OAuthDiscoveryState,
} from '@modelcontextprotocol/sdk/client/auth.js';
import {
  auth,
  discoverOAuthServerInfo,
  refreshAuthorization,
  UnauthorizedError,
} from '@modelcontextprotocol/sdk/client/auth.js';

import { Logger } from '@meek/agent-core';
import { MCP_OAUTH_CALLBACK_PATH, resolveMcpOAuthRedirectUrl } from '@meek/shared';

import { MCPClientIdentity } from '../config/mcp-client-identity.js';
import { McpServerAuthService } from '../services/mcp-server-auth.service.js';

import { getMcpOAuthRedirectOrigin } from './mcp-oauth-context.js';

const pendingAuthorizationUrls = new Map<string, string>();

function oauthRedirectUrl(): string {
  return resolveMcpOAuthRedirectUrl(getMcpOAuthRedirectOrigin());
}

function pendingAuthKey(configUserId: string | null, serverId: string): string {
  return `${configUserId ?? 'seed'}:${serverId}`;
}

export { MCP_OAUTH_CALLBACK_PATH };

export class McpOAuthProvider implements OAuthClientProvider {
  constructor(
    private readonly serverId: string,
    private readonly configUserId: string | null = null
  ) {}

  get redirectUrl(): string {
    return oauthRedirectUrl();
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: MCPClientIdentity.name,
      redirect_uris: [oauthRedirectUrl()],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    return (await McpServerAuthService.load(this.serverId, this.configUserId ?? undefined))
      ?.clientInfo;
  }

  async saveClientInformation(clientInformation: OAuthClientInformationMixed): Promise<void> {
    await McpServerAuthService.patch(
      this.serverId,
      { clientInfo: clientInformation },
      this.configUserId ?? undefined
    );
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    return (await McpServerAuthService.load(this.serverId, this.configUserId ?? undefined))?.tokens;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await McpServerAuthService.saveTokens(this.serverId, tokens, this.configUserId ?? undefined);
    pendingAuthorizationUrls.delete(pendingAuthKey(this.configUserId, this.serverId));
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    pendingAuthorizationUrls.set(
      pendingAuthKey(this.configUserId, this.serverId),
      authorizationUrl.toString()
    );
    Logger.info('MCP OAUTH', `[${this.serverId}] 等待浏览器授权: ${authorizationUrl}`);
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await McpServerAuthService.patch(
      this.serverId,
      { codeVerifier },
      this.configUserId ?? undefined
    );
  }

  async codeVerifier(): Promise<string> {
    const verifier = (await McpServerAuthService.load(this.serverId, this.configUserId ?? undefined))
      ?.codeVerifier;
    if (!verifier) {
      throw new Error(`缺少 PKCE code_verifier: ${this.serverId}`);
    }
    return verifier;
  }

  async state(): Promise<string> {
    const value = `${this.serverId}:${randomBytes(16).toString('hex')}`;
    await McpServerAuthService.patch(
      this.serverId,
      { oauthState: value },
      this.configUserId ?? undefined
    );
    return value;
  }

  async saveDiscoveryState(state: OAuthDiscoveryState): Promise<void> {
    await McpServerAuthService.patch(
      this.serverId,
      { discoveryState: state },
      this.configUserId ?? undefined
    );
  }

  async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
    return (await McpServerAuthService.load(this.serverId, this.configUserId ?? undefined))
      ?.discoveryState;
  }

  async invalidateCredentials(
    _scope?: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery'
  ): Promise<void> {
    pendingAuthorizationUrls.delete(pendingAuthKey(this.configUserId, this.serverId));
    await McpServerAuthService.delete(this.serverId, this.configUserId ?? undefined);
  }
}

export function getPendingAuthorizationUrl(
  serverId: string,
  configUserId: string | null = null
): string | undefined {
  return pendingAuthorizationUrls.get(pendingAuthKey(configUserId, serverId));
}

export function shouldUseMcpOAuth(
  connectionType: string,
  headers: Record<string, string> | undefined
): boolean {
  return connectionType === 'HTTP' && !(headers && Object.keys(headers).length > 0);
}

export async function exchangeMcpOAuthCode(
  serverId: string,
  mcpUrl: string,
  authorizationCode: string,
  configUserId: string | null = null
): Promise<void> {
  const provider = new McpOAuthProvider(serverId, configUserId);
  const result = await auth(provider, {
    serverUrl: mcpUrl,
    authorizationCode,
  });
  if (result !== 'AUTHORIZED') {
    throw new UnauthorizedError('OAuth 授权未完成');
  }
}

export async function refreshMcpOAuthTokens(
  serverId: string,
  mcpUrl: string,
  configUserId: string | null = null
): Promise<boolean> {
  const stored = await McpServerAuthService.load(serverId, configUserId ?? undefined);
  if (!stored?.tokens?.refresh_token || !stored.clientInfo) {
    return false;
  }

  try {
    const discovery = stored.discoveryState ?? (await discoverOAuthServerInfo(mcpUrl));
    const newTokens = await refreshAuthorization(discovery.authorizationServerUrl, {
      metadata: discovery.authorizationServerMetadata,
      clientInformation: stored.clientInfo,
      refreshToken: stored.tokens.refresh_token,
    });
    await McpServerAuthService.saveTokens(serverId, newTokens, configUserId ?? undefined);
    Logger.info('MCP OAUTH', `[${serverId}] refresh token 成功`);
    return true;
  } catch (error) {
    Logger.warn(
      'MCP OAUTH',
      `[${serverId}] refresh token 失败: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

export async function clearMcpServerAuth(
  serverId: string,
  configUserId: string | null = null
): Promise<void> {
  pendingAuthorizationUrls.delete(pendingAuthKey(configUserId, serverId));
  await McpServerAuthService.delete(serverId, configUserId ?? undefined);
}
