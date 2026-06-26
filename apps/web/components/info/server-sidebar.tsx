'use client';

import { StatusDot } from '@/components/ui/status-dot';
import {
  IconPower,
  IconRefresh,
  IconSearch,
  IconSpinner,
} from '@/components/info/info-icons';
import type { ConnectionPending } from '@/lib/info/types';
import { isServerConnected, MCP_STATUS } from '@/lib/info/mcp-status';
import type { ServerInfo } from '@/lib/info/types';

function getPendingAction(
  connectionPending: ConnectionPending | null,
  serverId: string,
  status: string,
): 'connect' | 'disconnect' | null {
  if (!connectionPending || connectionPending.serverId !== serverId) {
    return null;
  }
  const connected = isServerConnected(status);
  if (connectionPending.action === 'connect' && !connected) {
    return 'connect';
  }
  if (connectionPending.action === 'disconnect' && connected) {
    return 'disconnect';
  }
  return null;
}

export interface ServerSidebarProps {
  servers: ServerInfo[];
  currentServerId: string | null | undefined;
  searchQuery: string;
  connectionPending: ConnectionPending | null;
  onSearchChange: (query: string) => void;
  onRefresh: () => void;
  onSelectServer: (serverId: string) => void;
  onQuickConnect: (serverId: string, status: string) => void;
  onAddServer: () => void;
}

export function ServerSidebar({
  servers,
  currentServerId,
  searchQuery,
  connectionPending,
  onSearchChange,
  onRefresh,
  onSelectServer,
  onQuickConnect,
  onAddServer,
}: ServerSidebarProps): React.ReactElement {
  const query = searchQuery.trim().toLowerCase();
  const filtered = servers.filter(
    (server) => !query || server.name.toLowerCase().includes(query),
  );

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <h2>服务器</h2>
        <button type="button" className="icon-btn" aria-label="刷新" onClick={onRefresh}>
          <IconRefresh />
        </button>
      </div>

      <div className="search-wrap">
        <IconSearch />
        <input
          type="search"
          placeholder="搜索服务器"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="server-list">
        {filtered.map((server) => {
          const connected = isServerConnected(server.status);
          const needsAuth = server.status === MCP_STATUS.NeedsAuth;
          const pendingAction = getPendingAction(connectionPending, server.id, server.status);
          const dotVariant = connected ? 'on' : needsAuth ? 'warn' : 'off';

          return (
            <div
              key={server.id}
              className={`server-item${server.id === currentServerId ? ' active' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelectServer(server.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectServer(server.id);
                }
              }}
            >
              <div className="server-item-main">
                <StatusDot variant={dotVariant} />
                <span className="server-item-name">{server.name}</span>
              </div>
              <button
                type="button"
                className={`server-quick${connected ? ' on' : ''}${pendingAction ? ' is-loading' : ''}`}
                title={
                  pendingAction === 'connect'
                    ? '连接中…'
                    : pendingAction === 'disconnect'
                      ? '断开中…'
                      : connected
                        ? '断开'
                        : needsAuth
                          ? '授权'
                          : '连接'
                }
                disabled={Boolean(pendingAction) || Boolean(connectionPending)}
                data-requires-auth
                onClick={(event) => {
                  event.stopPropagation();
                  if (connectionPending) {
                    return;
                  }
                  onQuickConnect(server.id, server.status);
                }}
              >
                {pendingAction ? <IconSpinner /> : <IconPower />}
              </button>
            </div>
          );
        })}
      </div>

      <button type="button" className="add-btn" data-requires-auth onClick={onAddServer}>
        + 新增服务器
      </button>
    </aside>
  );
}
