import { LRUCache } from 'lru-cache';

import { Logger, ToolNameCodec } from '@meek/agent-core';
import { ConnectionType } from '@meek/db';
import type { GetPromptResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

import { McpPoolConfig } from '../config/mcp-pool-config.js';
import { MCPClientIdentity } from '../config/mcp-client-identity.js';
import { McpConfigStore, type ReloadMcpScope } from '../services/mcp-config.store.js';
import type { MCPConfigType, MCPServer } from '../types/mcp-config.types.js';
import {
  McpConnectionStatus,
  type McpConnectMode,
  type McpEnsureOptions,
} from '../types/mcp-connection.types.js';
import type {
  CallToolOptions,
  ClientInfo,
  McpPromptInfo,
  McpResourceInfo,
  MCPServerInfo,
  ServerInfo,
  ToolInfo,
} from '../types/mcp-runtime.types.js';

import {
  clearMcpServerAuth,
  exchangeMcpOAuthCode,
  getPendingAuthorizationUrl,
  refreshMcpOAuthTokens,
  shouldUseMcpOAuth,
} from './mcp-oauth.js';
import { ServerConnection } from './server-connection.js';

function resolveConnectMode(options?: McpEnsureOptions): McpConnectMode {
  if (options?.mode) {
    return options.mode;
  }
  if (options?.chatRequestId) {
    return 'chat-ephemeral';
  }
  return 'admin-probe';
}

const userMcpClientPool = new LRUCache<string, MCPClientManager>({
  max: McpPoolConfig.maxClients,
  ttl: McpPoolConfig.clientTtlMs,
  dispose: (client) => {
    // LRU 驱逐时异步断连（不阻塞）
    client.disconnectAll().catch((err: unknown) => {
      Logger.error('MCP CLIENT', 'Pool eviction disconnectAll failed:', err);
    });
    client.stopAutoReconnect();
  }
});

/**
 * 获取指定用户的 MCPClientManager（懒加载，LRU 池管理）。
 * - userId=null → 全局 seed 实例（guest / IM 共享）
 * - userId 非 null → per-user 隔离实例（首次访问时创建并连接）
 */
export function getMcpClientForUser(userId: string | null): MCPClientManager {
  if (userId === null) return mcpClient;
  let client = userMcpClientPool.get(userId);
  if (!client) {
    client = new MCPClientManager(userId);
    userMcpClientPool.set(userId, client);
    Logger.info('MCP CLIENT', `Per-user MCP client created userId=${userId}`);
  }
  return client;
}

/**
 * 失效指定用户的 MCP 连接池缓存（配置变更后调用）。
 * 不传 userId 时失效全部 per-user 实例（不影响全局 seed mcpClient）。
 */
export function invalidateMcpClientForUser(userId?: string): void {
  if (userId !== undefined) {
    userMcpClientPool.delete(userId); // dispose 回调会断连
  } else {
    userMcpClientPool.clear();
  }
  Logger.info('MCP CLIENT', `MCP client pool invalidated userId=${userId ?? 'all'}`);
}

/**
 * MCP客户端管理器类
 * 负责管理多个MCP服务器连接
 */
export class MCPClientManager {
  private connections: Map<string, ServerConnection> = new Map();
  private toolServerMap: Map<string, string> = new Map(); // 工具编码名称到服务器ID的映射
  private toolsCache: Map<string, ToolInfo[]> = new Map(); // 服务器ID到工具列表的缓存，连接/重连时更新
  private toolsCacheTimestamps: Map<string, number> = new Map(); // 缓存写入时间戳，用于 TTL 检查
  private static readonly TOOLS_CACHE_TTL = McpPoolConfig.toolsCacheTtlMs;
  private currentServerId?: string; // 当前选中的服务器ID
  private mcpConfig: MCPConfigType | null = null;
  private reconnectTimer?: NodeJS.Timeout; // 存储定时重连的计时器ID
  private static readonly RECONNECT_INTERVAL = McpPoolConfig.reconnectIntervalMs;
  /** Web/IM 聊天临时连接：账号 DB 未 enabled 时按需连、轮次结束后释放，不影响 Info 页态 */
  private readonly chatEphemeralByRequest = new Map<string, Set<string>>();

  /** per-user 隔离键；null = seed/guest 全局实例 */
  private readonly userId: string | null;
  private initPromise: Promise<void>;

  constructor(userId: string | null = null) {
    this.userId = userId;
    this.initPromise = this.initializeConnections()
      .then(() => this.restoreAccountEnabledConnections())
      .catch((error) => {
        Logger.error('MCP CLIENT', '初始化连接失败:', error);
      });

    // 启动定时重连功能
    this.startAutoReconnect();
  }

  /** 恢复 DB enabled=true 的账号默认连接（不影响 chat-ephemeral 语义） */
  private async restoreAccountEnabledConnections(): Promise<void> {
    if (!this.mcpConfig) {
      this.mcpConfig = await McpConfigStore.get(this.userId ?? undefined);
    }

    for (const serverConfig of this.mcpConfig.servers) {
      if (!serverConfig.enabled) {
        continue;
      }

      const connection = this.connections.get(serverConfig.serverId);
      if (!connection?.isTransportReady()) {
        Logger.debug(
          'MCP CLIENT',
          `服务器 ${serverConfig.name} (${serverConfig.serverId}) 传输层不可用，跳过默认恢复`,
        );
        continue;
      }

      try {
        await this.ensureServerReachable(serverConfig.serverId, { mode: 'account-default' });
      } catch (error) {
        Logger.error(
          'MCP CLIENT',
          `恢复账号默认连接 ${serverConfig.serverId} 失败:`,
          error,
        );
      }
    }
  }

  /** 等待首次（或最近一次 restartAll）连接初始化完成 */
  async ensureReady(): Promise<void> {
    await this.initPromise;
  }

  /**
   * Info 页 SSOT：断开 DB enabled=false 却仍连在池内的服（chat 嗅探等残留）。
   */
  async reconcilePoolWithDbEnabled(): Promise<void> {
    this.mcpConfig = await McpConfigStore.get(this.userId ?? undefined);

    for (const serverConfig of this.mcpConfig.servers) {
      if (serverConfig.enabled) {
        continue;
      }

      const connection = this.connections.get(serverConfig.serverId);
      if (!connection?.isConnected()) {
        continue;
      }

      try {
        await this.disconnect(serverConfig.serverId, { clearAuth: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Logger.debug(
          'MCP CLIENT',
          `reconcile 断开未启用服 ${serverConfig.serverId} 失败: ${message}`,
        );
      }
    }
  }

  /**
   * 启动定时维护：非 OAuth 服 8h 重连；OAuth 服优先 refresh token
   */
  private startAutoReconnect(): void {
    this.stopAutoReconnect();
    
    this.reconnectTimer = setInterval(async () => {
      await this.runScheduledConnectionMaintenance();
    }, MCPClientManager.RECONNECT_INTERVAL);
  }

  private async runScheduledConnectionMaintenance(): Promise<void> {
    if (!this.mcpConfig) {
      this.mcpConfig = await McpConfigStore.get(this.userId ?? undefined);
    }

    for (const serverConfig of this.mcpConfig.servers) {
      if (!serverConfig.enabled) {
        continue;
      }

      if (shouldUseMcpOAuth(serverConfig.connectionType, serverConfig.headers)) {
        if (!serverConfig.mcpUrl) {
          continue;
        }
        const refreshed = await refreshMcpOAuthTokens(
          serverConfig.serverId,
          serverConfig.mcpUrl,
          this.userId
        );
        if (!refreshed) {
          this.connections.get(serverConfig.serverId)?.markNeedsAuth();
        }
        continue;
      }

      try {
        await this.restart(serverConfig.serverId);
      } catch (error) {
        Logger.error('MCP CLIENT', `定时重连 ${serverConfig.serverId} 失败:`, error);
      }
    }
  }
  
  /**
   * 停止定时重连功能（供内部调用及 pool dispose）
   */
  stopAutoReconnect(): void {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  /**
   * 初始化连接对象；默认仅建连接对象。restartAll 等全量重建时传 connectEnabled: true 恢复 DB enabled 服。
   */
  private async initializeConnections(options?: { connectEnabled?: boolean }): Promise<void> {
    const connectEnabled = options?.connectEnabled ?? false;
    this.connections.clear();
    this.toolServerMap.clear();
    this.toolsCache.clear();
    this.toolsCacheTimestamps.clear();
    
    try {
      // 从 McpConfigStore 获取最新 MCP 配置
      this.mcpConfig = await McpConfigStore.get(this.userId ?? undefined);

      for (const serverConfig of this.mcpConfig.servers) {
        const connection = new ServerConnection(serverConfig, this.userId);
        this.connections.set(serverConfig.serverId, connection);
      }
      
      for (const serverConfig of this.mcpConfig.servers) {
        const connection = this.connections.get(serverConfig.serverId);
        if (!connection) continue;

        connection.onToolsChanged = async (serverId: string) => {
          await this.updateToolServerMap(serverId);
        };

        if (!connectEnabled) {
          continue;
        }

        if (!serverConfig.enabled) {
          Logger.debug(
            'MCP CLIENT',
            `服务器 ${serverConfig.name} (${serverConfig.serverId}) 未激活，跳过连接`,
          );
          continue;
        }

        if (!connection.isTransportReady()) {
          Logger.debug(
            'MCP CLIENT',
            `服务器 ${serverConfig.name} (${serverConfig.serverId}) 传输层不可用，跳过连接`,
          );
          continue;
        }

        try {
          const connected = await connection.connect();
          await this.updateToolServerMap(serverConfig.serverId);

          if (connected && !this.currentServerId) {
            this.currentServerId = serverConfig.serverId;
          }
        } catch (error) {
          Logger.error('MCP CLIENT', `连接服务器 ${serverConfig.name} (${serverConfig.serverId}) 失败:`, error);
        }
      }
      
      // 如果没有成功连接任何服务器但有可用服务器，设置第一个为当前服务器
      if (this.connections.size > 0 && !this.currentServerId) {
        const firstServerId = Array.from(this.connections.keys())[0];
        this.currentServerId = firstServerId;
      }
    } catch (error) {
      Logger.error('MCP CLIENT', '获取MCP配置失败:', error);
    }
  }

  /**
   * 更新工具服务器映射
   * @param serverId 服务器ID
   */
  private async updateToolServerMap(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.isConnected()) return;
    
    try {
      const tools = await connection.getTools();
      // 更新 codeName → serverId 映射
      for (const tool of tools) {
        this.toolServerMap.set(tool.codeName, serverId);
      }
      // 缓存工具列表并记录时间戳
      this.toolsCache.set(serverId, tools);
      this.toolsCacheTimestamps.set(serverId, Date.now());
    } catch (error) {
      Logger.error('MCP CLIENT', `更新工具服务器映射失败:`, error);
    }
  }

  /**
   * 检查指定服务器的工具缓存是否已过期
   */
  private isToolsCacheStale(serverId: string): boolean {
    const timestamp = this.toolsCacheTimestamps.get(serverId);
    if (!timestamp) return true;
    return Date.now() - timestamp > MCPClientManager.TOOLS_CACHE_TTL;
  }

  /** 未连接时复用最近一次 listTools 缓存（供 Web 弹窗工具数展示） */
  getCachedTools(serverId: string): ToolInfo[] {
    const cached = this.toolsCache.get(serverId);
    if (!cached || this.isToolsCacheStale(serverId)) {
      return [];
    }
    return cached;
  }

  /**
   * 检查服务器连接状态
   * @param serverId 服务器ID
   * @returns 是否连接正常
   */
  async pingServer(serverId: string): Promise<boolean> {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.isConnected()) {
      return false;
    }

    return await connection.ping();
  }

  /**
   * 确保指定服务器可达：已连接则 ping，未连接则 connect。
   * chatRequestId：聊天轮次内对账号未 enabled 的服务建临时连接，轮次结束后 releaseChatEphemeralConnections。
   */
  beginChatEphemeralScope(chatRequestId: string): void {
    if (!this.chatEphemeralByRequest.has(chatRequestId)) {
      this.chatEphemeralByRequest.set(chatRequestId, new Set());
    }
  }

  async releaseChatEphemeralConnections(chatRequestId: string): Promise<void> {
    const serverIds = this.chatEphemeralByRequest.get(chatRequestId);
    this.chatEphemeralByRequest.delete(chatRequestId);
    if (!serverIds || serverIds.size === 0) {
      return;
    }

    for (const serverId of serverIds) {
      try {
        await this.disconnect(serverId, { clearAuth: false });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        Logger.debug('MCP CLIENT', `释放聊天临时连接 ${serverId} 失败: ${message}`);
      }
    }
  }

  private trackChatEphemeralConnection(chatRequestId: string, serverId: string): void {
    let tracked = this.chatEphemeralByRequest.get(chatRequestId);
    if (!tracked) {
      tracked = new Set();
      this.chatEphemeralByRequest.set(chatRequestId, tracked);
    }
    tracked.add(serverId);
  }

  async ensureServerReachable(
    serverId: string,
    options?: McpEnsureOptions
  ): Promise<boolean> {
    const mode = resolveConnectMode(options);

    if (!this.mcpConfig) {
      this.mcpConfig = await McpConfigStore.get(this.userId ?? undefined);
    }
    const serverConfig = this.mcpConfig.servers.find((s) => s.serverId === serverId);
    if (!serverConfig) {
      return false;
    }

    if (mode === 'account-default' && !serverConfig.enabled) {
      return false;
    }

    const connection = this.connections.get(serverId);
    if (!connection) {
      return false;
    }

    const wasConnected = connection.isConnected();

    try {
      let ok: boolean;
      if (wasConnected) {
        ok = await connection.ping();
      } else {
        ok = await this.connect(serverId);
      }
      if (
        ok &&
        mode === 'chat-ephemeral' &&
        options?.chatRequestId &&
        !serverConfig.enabled
      ) {
        this.trackChatEphemeralConnection(options.chatRequestId, serverId);
      }
      return ok;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Logger.debug('MCP CLIENT', `ensureServerReachable ${serverId} 失败: ${message}`);
      return false;
    }
  }

  /**
   * 批量按连通性拆分 ID（串行探测，复用运行时连接池）。
   */
  /**
   * 按需连接指定服务器（聊天/运行时入口，串行避免 stdio 竞态）。
   */
  async ensureServersReachable(
    serverIds: string[],
    options?: McpEnsureOptions
  ): Promise<void> {
    await this.ensureReady();
    for (const serverId of [...new Set(serverIds)]) {
      await this.ensureServerReachable(serverId, options);
    }
  }

  async partitionServerIdsByReachability(
    serverIds: string[],
    options?: McpEnsureOptions
  ): Promise<{ reachableIds: string[]; unreachableIds: string[] }> {
    await this.ensureReady();

    const reachableIds: string[] = [];
    const unreachableIds: string[] = [];

    for (const serverId of [...new Set(serverIds)]) {
      if (!this.connections.has(serverId)) {
        unreachableIds.push(serverId);
        continue;
      }

      const ok = await this.ensureServerReachable(serverId, options);
      if (ok) {
        reachableIds.push(serverId);
      } else {
        unreachableIds.push(serverId);
      }
    }

    reachableIds.sort();
    return { reachableIds, unreachableIds };
  }

  /**
   * 获取可用服务器列表
   */
  async getAvailableServers(): Promise<ServerInfo[]> {
    const servers: ServerInfo[] = [];
    
    for (const connection of this.connections.values()) {
      const serverInfo = await connection.getServerInfo();
      servers.push(serverInfo);
    }
    
    return servers;
  }

  /**
   * 获取已连接的服务器列表
   */
  async getConnectedServers(): Promise<ServerInfo[]> {
    const servers: ServerInfo[] = [];
    
    for (const connection of this.connections.values()) {
      if (connection.isConnected()) {
        const serverInfo = await connection.getServerInfo();
        servers.push(serverInfo);
      }
    }
    
    return servers;
  }

  /**
   * 获取服务器和工具信息
   * @returns MCP服务器信息
   */
  async getServerInfo(): Promise<MCPServerInfo> {
    // 选择当前服务器
    let currentServer: ServerInfo | null = null;
    
    // 如果有当前选中的服务器ID，优先使用它
    if (this.currentServerId) {
      const connection = this.connections.get(this.currentServerId);
      if (connection) {
        currentServer = await connection.getServerInfo();
      }
    }
    
    // 如果没有当前服务器，获取第一个已连接的服务器
    if (!currentServer) {
      for (const connection of this.connections.values()) {
        if (connection.isConnected()) {
          currentServer = await connection.getServerInfo();
          this.currentServerId = connection.getId(); // 更新当前服务器ID
          break;
        }
      }
    }
    
    // 如果仍然没有，使用第一个可用服务器
    if (!currentServer && this.connections.size > 0) {
      const firstConnection = Array.from(this.connections.values())[0];
      if (firstConnection) {
        currentServer = await firstConnection.getServerInfo();
        this.currentServerId = firstConnection.getId(); // 更新当前服务器ID
      }
    }
    
    // 如果仍然没有，创建一个默认的服务器信息
    if (!currentServer) {
      currentServer = {
        id: '',
        name: "未知服务器",
        version: "未知",
        status: McpConnectionStatus.Disconnected,
        connectionDetails: {
          connectionType: ConnectionType.STDIO,
          displayCommand: ''
        }
      };
    }
    
    const allTools: ToolInfo[] = [];
    const serverTools: Record<string, ToolInfo[]> = {};
    const serverResources: Record<string, McpResourceInfo[]> = {};
    const serverPrompts: Record<string, McpPromptInfo[]> = {};
    const connectedServers: ServerInfo[] = [];
    
    // 汇总所有已连接服务器的工具（优先使用缓存，避免每次发起 listTools 网络请求）
    for (const connection of this.connections.values()) {
      if (connection.isConnected()) {
        const serverInfo = await connection.getServerInfo();
        connectedServers.push(serverInfo);
        
        const serverId = connection.getId();
        const cachedTools = this.toolsCache.get(serverId);
        const cacheStale = this.isToolsCacheStale(serverId);

        if (cachedTools && !cacheStale) {
          serverTools[serverId] = cachedTools;
          allTools.push(...cachedTools);
        } else {
          // 缓存未命中或已过期（TTL 5分钟），重新拉取工具列表
          await this.updateToolServerMap(serverId);
          const freshTools = this.toolsCache.get(serverId) ?? [];
          serverTools[serverId] = freshTools;
          allTools.push(...freshTools);
        }

        const [resources, prompts] = await Promise.all([
          connection.listResources(),
          connection.listPrompts(),
        ]);
        serverResources[serverId] = resources;
        serverPrompts[serverId] = prompts;
      }
    }
    
    const info: MCPServerInfo = {
      server: currentServer,
      currentServerId: this.currentServerId,
      tools: allTools,
      availableServers: await this.getAvailableServers(),
      connectedServers,
      serverTools,
      serverResources,
      serverPrompts,
    };

    return info;
  }

  /**
   * 获取客户端信息
   * 客户端身份来自代码常量 MCPClientIdentity（不再依赖数据库）
   */
  async getClientInfo(): Promise<ClientInfo> {
    return {
      name: MCPClientIdentity.name,
      version: MCPClientIdentity.version
    };
  }

  /**
   * 根据工具编码名称找到对应的服务器连接
   * @param codeName 工具编码名称
   * @returns 服务器连接对象
   */
  private findServerForTool(codeName: string): ServerConnection | undefined {
    const serverId = this.toolServerMap.get(codeName);
    if (serverId) {
      return this.connections.get(serverId);
    }
    
    return undefined;
  }

  /** 根据 codeName 解析 MCP 服务器 ID（审计 / 排障） */
  getServerIdForTool(codeName: string): string | undefined {
    return this.toolServerMap.get(codeName);
  }

  /** 根据 serverId 解析展示名 */
  getServerName(serverId: string): string | undefined {
    return this.connections.get(serverId)?.getName();
  }

  /**
   * 收集指定服务器（或所有已连接服务器）的 instructions 并合并为单个字符串。
   *
   * 业界惯例（参考 GitHub MCP Server 官方实现）：
   *   - 只为"已启用工具的服务器"注入 instructions，避免不相关上下文占用 token
   *   - 多服务器时以 "## [server-name]\n" 标注来源，便于 LLM 区分
   *   - 全部为空时返回空字符串
   *
   * @param enabledServerIds 限定范围的服务器 ID 列表；不传则取所有已连接服务器
   */
  getInstructions(enabledServerIds?: string[]): string {
    const parts: string[] = [];
    for (const connection of this.connections.values()) {
      if (!connection.isConnected()) continue;
      if (enabledServerIds && !enabledServerIds.includes(connection.getId())) continue;

      const inst = connection.getInstructions();
      if (!inst) continue;

      // 多服务器时加标注，单服务器时直接注入保持简洁
      const label = enabledServerIds && enabledServerIds.length > 1
        ? `## ${connection.getName()}\n${inst}`
        : inst;
      parts.push(label);
    }
    return parts.join('\n\n');
  }

  /**
   * 调用工具
   * options 由调用方在运行时显式传入（如 openai.ts 对 executeApi 统一注入 supportsProgress）。
   */
  async callTool<T>(
    codeName: string,
    args: Record<string, unknown>,
    options?: CallToolOptions
  ): Promise<T> {
    const connection = this.findServerForTool(codeName);
    const toolName = ToolNameCodec.decode(codeName);
    if (!connection) {
      throw new Error(`找不到工具 ${toolName} 所属的服务器或所有服务器都未连接`);
    }

    return await connection.callTool<T>(toolName, args, options);
  }

  /**
   * 解析指定服务器上的工具原名（支持 codeName 或原名）
   */
  async resolveToolNameOnServer(serverId: string, toolNameOrCodeName: string): Promise<string> {
    if (toolNameOrCodeName.startsWith('mcp__')) {
      return ToolNameCodec.decode(toolNameOrCodeName);
    }

    let tools = this.toolsCache.get(serverId);
    const connection = this.connections.get(serverId);
    if (!tools && connection?.isConnected()) {
      await this.updateToolServerMap(serverId);
      tools = this.toolsCache.get(serverId);
    }

    const matched = tools?.find(
      (t) => t.name === toolNameOrCodeName || t.codeName === toolNameOrCodeName
    );
    if (!matched) {
      throw new Error(`工具 ${toolNameOrCodeName} 不存在于服务器 ${serverId}`);
    }
    return matched.name;
  }

  /**
   * 在指定已连接服务器上调用工具（Info 页试跑）
   */
  async callToolOnServer<T>(
    serverId: string,
    toolNameOrCodeName: string,
    args: Record<string, unknown>,
    options?: CallToolOptions
  ): Promise<T> {
    const connection = this.connections.get(serverId);
    if (!connection?.isConnected()) {
      throw new Error(`服务器 ${serverId} 未连接`);
    }
    const toolName = await this.resolveToolNameOnServer(serverId, toolNameOrCodeName);
    return connection.callTool<T>(toolName, args, options);
  }

  async readResourceOnServer(serverId: string, uri: string): Promise<ReadResourceResult> {
    const connection = this.requireConnectedConnection(serverId);
    return connection.readResource(uri);
  }

  async getPromptOnServer(
    serverId: string,
    name: string,
    args?: Record<string, string>
  ): Promise<GetPromptResult> {
    const connection = this.requireConnectedConnection(serverId);
    return connection.getPrompt(name, args);
  }

  private requireConnectedConnection(serverId: string): ServerConnection {
    const connection = this.connections.get(serverId);
    if (!connection?.isConnected()) {
      throw new Error(`服务器 ${serverId} 未连接`);
    }
    return connection;
  }

  /**
   * 断开所有服务器连接
   */
  async disconnectAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const connection of this.connections.values()) {
      if (connection.isConnected()) {
        promises.push(connection.disconnect());
      }
    }
    
    await Promise.all(promises);
  }

  /**
   * 断开指定服务器连接；OAuth 服默认清除 token
   */
  async disconnect(serverId: string, options?: { clearAuth?: boolean }): Promise<void> {
    const connection = this.connections.get(serverId);
    if (connection) {
      await connection.disconnect();
    }

    const clearAuth = options?.clearAuth ?? connection?.usesOAuth() ?? false;
    if (clearAuth) {
      await clearMcpServerAuth(serverId, this.userId);
    }
  }

  /**
   * OAuth 回调完成后重连
   */
  async finishOAuthAndConnect(serverId: string, authorizationCode: string): Promise<boolean> {
    if (!this.mcpConfig) {
      this.mcpConfig = await McpConfigStore.get(this.userId ?? undefined);
    }
    const serverConfig = this.mcpConfig.servers.find((s) => s.serverId === serverId);
    if (!serverConfig?.mcpUrl) {
      throw new Error(`未找到服务器: ${serverId}`);
    }
    await exchangeMcpOAuthCode(serverId, serverConfig.mcpUrl, authorizationCode, this.userId);
    return this.connect(serverId);
  }

  getOAuthAuthorizationUrl(serverId: string): string | undefined {
    return getPendingAuthorizationUrl(serverId, this.userId);
  }

  /**
   * 重启所有服务器连接
   */
  async restartAll(): Promise<void> {
    // 记录当前是否存在定时器
    const hasTimer = !!this.reconnectTimer;
    
    // 先获取最新配置
    try {
      this.mcpConfig = await McpConfigStore.get(this.userId ?? undefined);
      
      // 断开现有的所有连接并重新初始化
      await this.disconnectAll();
      this.initPromise = this.initializeConnections({ connectEnabled: true });
      await this.initPromise;
      
      // 如果之前存在定时器，重新启动定时重连功能
      if (hasTimer) {
        this.startAutoReconnect();
      }
    } catch (error) {
      Logger.error('MCP CLIENT', '重启所有服务器连接失败:', error);
      throw error;
    }
  }

  /** 同步内存配置中的 enabled（DB 已由 McpConfigStore 更新） */
  syncServerEnabled(serverId: string, enabled: boolean): void {
    if (!this.mcpConfig) {
      return;
    }
    const server = this.mcpConfig.servers.find((s) => s.serverId === serverId);
    if (server) {
      server.enabled = enabled;
    }
  }

  /**
   * 按最新配置重建单服连接对象（结构变更 / 增删服，不影响其它服）
   */
  async reloadServerFromConfig(serverId: string): Promise<void> {
    this.mcpConfig = await McpConfigStore.get(this.userId ?? undefined);
    const serverConfig = this.mcpConfig.servers.find((s) => s.serverId === serverId);

    const existing = this.connections.get(serverId);
    if (existing) {
      await existing.disconnect();
      this.connections.delete(serverId);
      this.toolsCache.delete(serverId);
      this.toolsCacheTimestamps.delete(serverId);
    }

    if (!serverConfig) {
      return;
    }

    const connection = new ServerConnection(serverConfig, this.userId);
    connection.onToolsChanged = async (sid: string) => {
      await this.updateToolServerMap(sid);
    };
    this.connections.set(serverId, connection);

    if (serverConfig.enabled && connection.isTransportReady()) {
      try {
        await connection.connect();
        await this.updateToolServerMap(serverId);
      } catch (error) {
        Logger.error('MCP CLIENT', `重载服务器 ${serverId} 连接失败:`, error);
      }
    } else if (serverConfig.enabled && !connection.isTransportReady()) {
      Logger.debug('MCP CLIENT', `服务器 ${serverConfig.name} (${serverConfig.serverId}) 传输层不可用，跳过连接`);
    }
  }

  /**
   * 重启指定服务器连接（传输层重连，配置未变）
   */
  async restart(serverId: string): Promise<boolean> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return false;
    }
    
    try {
      const success = await connection.restart();
      
      if (success) {
        // 确保回调在重连后仍然绑定
        connection.onToolsChanged = async (sid: string) => {
          await this.updateToolServerMap(sid);
        };
        // 更新工具映射
        await this.updateToolServerMap(serverId);
      }
      
      return success;
    } catch (error) {
      Logger.error('MCP CLIENT', `重启服务器 ${serverId} 失败:`, error);
      return false;
    }
  }

  /**
   * 连接指定服务器；失败时抛出底层错误供 API 层返回详情。
   */
  async connect(serverId: string): Promise<boolean> {
    const connection = this.connections.get(serverId);
    if (!connection) {
      throw new Error(`未找到服务器: ${serverId}`);
    }

    const success = await connection.connect();

    if (success) {
      await this.updateToolServerMap(serverId);
    }

    return success;
  }

  /**
   * 获取指定服务器的连接对象
   */
  getConnection(serverId: string): ServerConnection | undefined {
    return this.connections.get(serverId);
  }

  /**
   * 切换当前服务器
   */
  switchCurrentServer(serverId: string): boolean {
    const connection = this.connections.get(serverId);
    if (!connection) {
      return false;
    }
    
    this.currentServerId = serverId;
    return true;
  }
}

/**
 * 应用配置变更到运行时连接。
 * - scope='all'：全量重建（手动 reload / reset）
 * - scope={ serverId }：仅重建单服（结构变更 / 增删）
 */
export async function reloadMCPConfig(
  configUserId?: string,
  scope: ReloadMcpScope = 'all'
): Promise<boolean> {
  try {
    if (configUserId !== undefined) {
      const client = userMcpClientPool.get(configUserId);
      if (!client) {
        return true;
      }
      if (scope === 'all') {
        await client.restartAll();
      } else {
        await client.reloadServerFromConfig(scope.serverId);
      }
    } else {
      await mcpClient.restartAll();
      invalidateMcpClientForUser();
    }
    return true;
  } catch (error) {
    Logger.error('MCP CLIENT', '重新加载MCP配置失败:', error);
    return false;
  }
}

export type { ReloadMcpScope };

/**
 * 全局MCP客户端实例（seed/null userId，guest 与 IM 共享）
 */
export const mcpClient = new MCPClientManager(null);

