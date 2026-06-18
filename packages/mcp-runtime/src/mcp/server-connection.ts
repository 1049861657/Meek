import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import type {
  ClientCapabilities,
  GetPromptResult,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import {
  McpError,
  ErrorCode,
  ToolListChangedNotificationSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { Logger, ToolNameCodec } from '@meek/agent-core';
import { ConnectionType } from '@meek/db';

import {
  MCPClientIdentity,
  parseMcpClientRootPathsFromEnv,
} from '../config/mcp-client-identity.js';
import { McpConfigStore } from '../services/mcp-config.store.js';
import type { MCPServer, MCPConfigType } from '../types/mcp-config.types.js';
import {
  isMcpConnected,
  McpConnectionStatus,
} from '../types/mcp-connection.types.js';
import type {
  CallToolOptions,
  McpPromptArgumentInfo,
  McpPromptInfo,
  McpResourceInfo,
  ServerInfo,
  ToolInfo,
} from '../types/mcp-runtime.types.js';

import { attachMcpRootsHandler } from './mcp-roots-handler.js';
import { attachMcpSamplingHandler } from './mcp-sampling-handler.js';
import {
  getPendingAuthorizationUrl,
  McpOAuthProvider,
  shouldUseMcpOAuth,
} from './mcp-oauth.js';

interface McpToolListItem {
  name?: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
}

export class ServerConnection {
  private client?: Client;
  private transport?: StdioClientTransport | StreamableHTTPClientTransport;
  private connectionStatus: McpConnectionStatus = McpConnectionStatus.Disconnected;
  private transportClosed = false;
  private id: string;
  private name: string;
  private version = '未知';
  private connectionType: ConnectionType;
  private usesOAuthTransport = false;
  private oauthProvider: McpOAuthProvider | null = null;
  private static readonly PING_TIMEOUT = 10000;
  private static readonly CONNECT_TIMEOUT = 60000;
  private mcpConfig: MCPConfigType | null = null;
  private instructions: string | undefined = undefined;
  private reconnectPromise: Promise<boolean> | null = null;
  onToolsChanged?: (serverId: string) => void;
  private readonly configUserId: string | null;

  constructor(serverConfig: MCPServer, configUserId: string | null = null) {
    this.configUserId = configUserId;
    this.id = serverConfig.serverId;
    this.name = serverConfig.name;
    this.connectionType = serverConfig.connectionType;

    const transport = this.createClientTransport(serverConfig);
    if (transport) {
      this.transport = transport;
      this.client = ServerConnection.createClient();
    }

    this.initConfig().catch((error: unknown) => {
      Logger.error('SERVER CONNECTION', '初始化配置失败:', error);
    });
  }

  private static createClient(): Client {
    const client = new Client(
      {
        name: MCPClientIdentity.name,
        version: MCPClientIdentity.version,
      },
      {
        capabilities: MCPClientIdentity.capabilities as ClientCapabilities,
      }
    );
    attachMcpSamplingHandler(client);
    attachMcpRootsHandler(client, parseMcpClientRootPathsFromEnv());
    return client;
  }

  private async initConfig(): Promise<void> {
    try {
      this.mcpConfig = await McpConfigStore.get(this.configUserId ?? undefined);
    } catch (error: unknown) {
      Logger.error('SERVER CONNECTION', '获取MCP配置失败:', error);
    }
  }

  private createClientTransport(
    serverConfig: MCPServer
  ): StdioClientTransport | StreamableHTTPClientTransport | null {
    const connectionType = serverConfig.connectionType;

    if (connectionType === ConnectionType.STDIO) {
      if (!serverConfig.command || !serverConfig.args) {
        Logger.error('SERVER CONNECTION', '无法创建stdio连接: 缺少command或args配置');
        return null;
      }
      this.usesOAuthTransport = false;
      this.oauthProvider = null;
      return new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
      });
    }

    if (connectionType === ConnectionType.HTTP) {
      if (!serverConfig.mcpUrl) {
        Logger.error('SERVER CONNECTION', '无法创建 HTTP 连接: 缺少 mcpUrl 配置');
        return null;
      }
      try {
        const url = new URL(serverConfig.mcpUrl);
        this.usesOAuthTransport = shouldUseMcpOAuth(connectionType, serverConfig.headers);
        this.oauthProvider = this.usesOAuthTransport
          ? new McpOAuthProvider(this.id, this.configUserId)
          : null;

        if (this.usesOAuthTransport) {
          return new StreamableHTTPClientTransport(url, {
            authProvider: this.oauthProvider ?? undefined,
          });
        }

        const opts =
          serverConfig.headers && Object.keys(serverConfig.headers).length > 0
            ? { requestInit: { headers: serverConfig.headers } }
            : undefined;
        return new StreamableHTTPClientTransport(url, opts);
      } catch (error: unknown) {
        Logger.error(
          'SERVER CONNECTION',
          `创建远程 MCP 传输失败: ${error instanceof Error ? error.message : String(error)}`
        );
        return null;
      }
    }

    Logger.error('SERVER CONNECTION', `不支持的连接类型: ${connectionType}`);
    return null;
  }

  private setConnectionStatus(status: McpConnectionStatus): void {
    this.connectionStatus = status;
  }

  getConnectionStatus(): McpConnectionStatus {
    return this.connectionStatus;
  }

  usesOAuth(): boolean {
    return this.usesOAuthTransport;
  }

  private async resetSession(): Promise<void> {
    try {
      if (typeof this.transport?.close === 'function') {
        await this.transport.close();
      }
    } catch (error: unknown) {
      Logger.debug(
        'SERVER CONNECTION',
        `[${this.name}] 清理传输层: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    this.transportClosed = true;
  }

  private async rebuildTransportStack(): Promise<void> {
    await this.resetSession();
    if (!this.mcpConfig) {
      this.mcpConfig = await McpConfigStore.get(this.configUserId ?? undefined);
    }
    const serverConfig = this.mcpConfig.servers.find((s) => s.serverId === this.id);
    if (!serverConfig) {
      throw new Error(`未找到服务器配置: ${this.id}`);
    }
    const newTransport = this.createClientTransport(serverConfig);
    if (!newTransport) {
      throw new Error(`创建传输层失败: ${this.id}`);
    }
    this.transport = newTransport;
    this.client = ServerConnection.createClient();
    this.transportClosed = false;
  }

  getConnectionDisplayCommand(serverConfig: MCPServer): string {
    if (this.connectionType === ConnectionType.STDIO && serverConfig.command) {
      return `${serverConfig.command} ${serverConfig.args?.join(' ') || ''}`;
    }
    if (this.connectionType === ConnectionType.HTTP && serverConfig.mcpUrl) {
      return serverConfig.mcpUrl;
    }
    return '';
  }

  async connect(): Promise<boolean> {
    if (isMcpConnected(this.connectionStatus) && !this.transportClosed) {
      return true;
    }

    this.setConnectionStatus(McpConnectionStatus.Connecting);

    try {
      if (!this.mcpConfig) {
        this.mcpConfig = await McpConfigStore.get(this.configUserId ?? undefined);
      }

      await this.rebuildTransportStack();

      const client = this.client;
      const transport = this.transport;
      if (!client || !transport) {
        throw new Error(`创建传输层失败: ${this.id}`);
      }

      await Promise.race([
        client.connect(transport),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`连接超时（${ServerConnection.CONNECT_TIMEOUT / 1000}s）`)),
            ServerConnection.CONNECT_TIMEOUT
          )
        ),
      ]);

      const sdkOnClose = transport.onclose;
      transport.onclose = () => {
        if (isMcpConnected(this.connectionStatus)) {
          this.setConnectionStatus(McpConnectionStatus.Disconnected);
          this.transportClosed = true;
          Logger.warn('SERVER CONNECTION', `[${this.name}] 传输层连接已断开`);
        }
        sdkOnClose?.();
      };

      client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
        Logger.info('SERVER CONNECTION', `[${this.name}] 收到工具列表变更通知，刷新缓存`);
        this.onToolsChanged?.(this.id);
      });

      const serverVersion = client.getServerVersion();
      if (serverVersion) {
        this.name = serverVersion.name || this.name;
        this.version = serverVersion.version || '未知';
      }

      this.instructions = client.getInstructions() ?? undefined;
      if (this.instructions) {
        Logger.debug(
          'SERVER CONNECTION',
          `服务器 ${this.name} 返回 instructions（${this.instructions.length} 字符）`
        );
      }

      this.setConnectionStatus(McpConnectionStatus.Connected);
      Logger.info(
        'SERVER CONNECTION',
        `MCP服务器 ${this.name} 连接成功！ clientCapabilities=${JSON.stringify(MCPClientIdentity.capabilities)}`
      );
      return true;
    } catch (error: unknown) {
      await this.resetSession();
      if (error instanceof UnauthorizedError) {
        this.setConnectionStatus(McpConnectionStatus.NeedsAuth);
        Logger.warn('SERVER CONNECTION', `[${this.name}] 需要 OAuth 授权`);
        return false;
      }
      this.setConnectionStatus(McpConnectionStatus.Failed);
      Logger.error('SERVER CONNECTION', '连接失败:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.resetSession();
    this.setConnectionStatus(McpConnectionStatus.Disconnected);
  }

  async restart(): Promise<boolean> {
    if (this.reconnectPromise) {
      Logger.debug('SERVER CONNECTION', `[${this.name}] 重连已在进行中，等待其完成`);
      return this.reconnectPromise;
    }

    this.reconnectPromise = (async () => {
      try {
        if (isMcpConnected(this.connectionStatus)) {
          await this.disconnect();
        }
        return await this.connect();
      } finally {
        this.reconnectPromise = null;
      }
    })();

    return this.reconnectPromise;
  }

  async ping(): Promise<boolean> {
    if (!isMcpConnected(this.connectionStatus) || !this.client) {
      return false;
    }

    try {
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Ping超时')), ServerConnection.PING_TIMEOUT);
      });

      const pingPromise = this.client.ping();
      const result = await Promise.race([pingPromise, timeoutPromise]);

      return !!result;
    } catch {
      return false;
    }
  }

  async getServerInfo(): Promise<ServerInfo> {
    if (!this.mcpConfig) {
      this.mcpConfig = await McpConfigStore.get(this.configUserId ?? undefined);
    }

    const serverConfig = this.mcpConfig.servers.find((s) => s.serverId === this.id);
    const displayCommand = serverConfig
      ? this.getConnectionDisplayCommand(serverConfig)
      : '';

    const authorizationUrl =
      this.connectionStatus === McpConnectionStatus.NeedsAuth
        ? getPendingAuthorizationUrl(this.id, this.configUserId)
        : undefined;

    return {
      id: this.id,
      name: serverConfig?.name || this.id,
      internalName: isMcpConnected(this.connectionStatus) ? this.name : undefined,
      version: this.version,
      status: this.connectionStatus,
      authorizationUrl,
      usesOAuth: this.usesOAuthTransport,
      connectionDetails: {
        connectionType: this.connectionType,
        command: serverConfig?.command || undefined,
        args: serverConfig?.args ? serverConfig.args.join(' ') : undefined,
        mcpUrl: serverConfig?.mcpUrl || undefined,
        headers: serverConfig?.headers || undefined,
        displayCommand,
      },
    };
  }

  private isUnsupportedMcpCapability(error: unknown): boolean {
    return error instanceof McpError && error.code === ErrorCode.MethodNotFound;
  }

  async listResources(): Promise<McpResourceInfo[]> {
    const client = this.client;
    if (!isMcpConnected(this.connectionStatus) || !client) {
      return [];
    }
    try {
      const result = await client.listResources();
      const resources = result.resources ?? [];
      return resources.map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
        serverId: this.id,
        serverName: this.name,
      }));
    } catch (error: unknown) {
      if (!this.isUnsupportedMcpCapability(error)) {
        Logger.error(
          'SERVER CONNECTION',
          `获取资源列表失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return [];
    }
  }

  async readResource(uri: string): Promise<ReadResourceResult> {
    const client = this.client;
    if (!isMcpConnected(this.connectionStatus) || !client) {
      throw new Error(`服务器 ${this.name} 未连接`);
    }
    return await client.readResource({ uri });
  }

  async listPrompts(): Promise<McpPromptInfo[]> {
    const client = this.client;
    if (!isMcpConnected(this.connectionStatus) || !client) {
      return [];
    }
    try {
      const result = await client.listPrompts();
      const prompts = result.prompts ?? [];
      return prompts.map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
        arguments: this.mapPromptArguments(prompt.arguments),
        serverId: this.id,
        serverName: this.name,
      }));
    } catch (error: unknown) {
      if (!this.isUnsupportedMcpCapability(error)) {
        Logger.error(
          'SERVER CONNECTION',
          `获取 Prompt 列表失败: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      return [];
    }
  }

  async getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult> {
    const client = this.client;
    if (!isMcpConnected(this.connectionStatus) || !client) {
      throw new Error(`服务器 ${this.name} 未连接`);
    }
    return await client.getPrompt({
      name,
      arguments: args,
    });
  }

  private mapPromptArguments(
    args: Array<{ name: string; description?: string; required?: boolean }> | undefined
  ): McpPromptArgumentInfo[] | undefined {
    if (!args?.length) {
      return undefined;
    }
    return args.map((arg) => ({
      name: arg.name,
      description: arg.description,
      required: arg.required,
    }));
  }

  async getTools(): Promise<ToolInfo[]> {
    const client = this.client;
    if (!isMcpConnected(this.connectionStatus) || !client) {
      return [];
    }

    try {
      const toolsResponse = await client.listTools();
      const tools = toolsResponse.tools ?? [];

      if (!Array.isArray(tools)) {
        return [];
      }

      return tools
        .filter((tool) => tool !== null && tool !== undefined)
        .map((tool) => {
          const item = tool as McpToolListItem;
          const toolName = item.name || '未命名工具';
          const toolDesc = item.description || `${toolName}工具`;
          const codeName = ToolNameCodec.encode(toolName, this.id);
          const parameters = this.extractParameters(item);

          return {
            name: toolName,
            codeName,
            description: toolDesc,
            parameters,
            serverId: this.id,
            serverName: this.name,
          };
        });
    } catch (error: unknown) {
      Logger.error(
        'SERVER CONNECTION',
        `获取工具列表失败: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  private extractParameters(tool: McpToolListItem): ToolInfo['parameters'] {
    const parameters: ToolInfo['parameters'] = [];

    try {
      if (tool.inputSchema?.properties) {
        const props = tool.inputSchema.properties;
        const required = Array.isArray(tool.inputSchema.required) ? tool.inputSchema.required : [];

        for (const key in props) {
          if (Object.prototype.hasOwnProperty.call(props, key)) {
            const schema = props[key] ?? {};
            parameters.push({
              name: key,
              type: schema.type ?? 'string',
              description: schema.description || `${key}`,
              required: required.includes(key),
            });
          }
        }
      }
    } catch (err: unknown) {
      Logger.error('SERVER CONNECTION', '解析工具参数时出错:', err);
    }
    return parameters;
  }

  private static readonly RETRIABLE_RPC_CODES = new Set([
    ErrorCode.ConnectionClosed,
    ErrorCode.RequestTimeout,
    -32002,
  ]);

  private static isAbortError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    if (error.name === 'AbortError' || error.name === 'APIUserAbortError') {
      return true;
    }
    return /aborted/i.test(error.message);
  }

  private isConnectionError(error: unknown): boolean {
    if (error instanceof McpError) {
      return ServerConnection.RETRIABLE_RPC_CODES.has(error.code);
    }

    if (error instanceof Error && 'code' in error) {
      const networkErrorCodes = new Set([
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        'EPIPE',
        'ENOTFOUND',
        'ENETUNREACH',
        'EHOSTUNREACH',
      ]);
      if (networkErrorCodes.has((error as NodeJS.ErrnoException).code ?? '')) {
        return true;
      }
    }

    if (error instanceof Error) {
      const jsonStart = error.message.indexOf('{');
      if (jsonStart !== -1) {
        try {
          const parsed = JSON.parse(error.message.slice(jsonStart)) as {
            error?: { code?: number };
          };
          const code = parsed.error?.code;
          if (typeof code === 'number') {
            return ServerConnection.RETRIABLE_RPC_CODES.has(code);
          }
        } catch {
          // 非 JSON 错误体
        }
      }
    }

    return false;
  }

  async callTool<T>(
    toolName: string,
    args: Record<string, unknown>,
    options?: CallToolOptions
  ): Promise<T> {
    if (!isMcpConnected(this.connectionStatus) || this.transportClosed) {
      Logger.info('SERVER CONNECTION', `[${this.name}] 检测到未连接，自动重连中...`);
      await this.restart();
    }

    const useProgress =
      options?.supportsProgress === true && typeof options?.onProgress === 'function';
    let stepStartTime = Date.now();

    const client = this.client;
    if (!client) {
      throw new Error(`服务器 ${this.name} 未连接`);
    }

    const executeCall = async (): Promise<T> => {
      return (await client.callTool(
        { name: toolName, arguments: args },
        undefined,
        {
          timeout: options?.timeout ?? 60000,
          resetTimeoutOnProgress: useProgress,
          signal: options?.signal,
          ...(useProgress
            ? {
                onprogress: (progressData: {
                  progress: number;
                  total?: number;
                  message?: string;
                }) => {
                  const now = Date.now();
                  const elapsed_ms = now - stepStartTime;
                  stepStartTime = now;
                  options!.onProgress!(
                    progressData.progress,
                    progressData.total,
                    progressData.message,
                    elapsed_ms
                  );
                },
              }
            : {}),
        }
      )) as T;
    };

    try {
      return await executeCall();
    } catch (error: unknown) {
      if (ServerConnection.isAbortError(error)) {
        Logger.debug('SERVER CONNECTION', `调用工具 ${toolName} 已取消`);
        throw error;
      }
      if (this.isConnectionError(error)) {
        Logger.warn(
          'SERVER CONNECTION',
          `[${this.name}] 工具 ${toolName} 调用失败（连接断开），自动重连后重试...`
        );
        this.setConnectionStatus(McpConnectionStatus.Disconnected);
        this.transportClosed = true;
        await this.restart();
        Logger.info('SERVER CONNECTION', `[${this.name}] 重连成功，重试 ${toolName}`);
        return await executeCall();
      }
      Logger.error(
        'SERVER CONNECTION',
        `调用工具 ${toolName} 失败: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  getInstructions(): string | undefined {
    return this.instructions;
  }

  isConnected(): boolean {
    return isMcpConnected(this.connectionStatus);
  }

  isTransportReady(): boolean {
    return this.transport !== undefined;
  }

  markNeedsAuth(): void {
    if (this.connectionType !== ConnectionType.STDIO) {
      this.setConnectionStatus(McpConnectionStatus.NeedsAuth);
    }
  }

  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }
}
