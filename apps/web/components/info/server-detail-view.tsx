'use client';

import { IconCheck, IconClose } from '@/components/info/info-icons';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/status-chip';
import { InfoResourcesPanel } from '@/components/info/rp-panel';
import { InfoToolsPanel } from '@/components/info/tools-panel';
import type { UseInfoAppResult } from '@/hooks/use-info-app';
import {
  isServerConnected,
  MCP_STATUS,
  serverStatusChipVariant,
  serverStatusLabel,
} from '@/lib/info/mcp-status';
import { countEnabledTools, isToolEnabled } from '@/lib/info/tool-preferences';
import type { InfoTab } from '@/lib/info/types';

function getPendingAction(
  app: UseInfoAppResult,
): 'connect' | 'disconnect' | null {
  const { connectionPending, currentData } = app;
  if (!connectionPending || !currentData?.currentServerId) {
    return null;
  }
  if (connectionPending.serverId !== currentData.server.id) {
    return null;
  }
  const connected = isServerConnected(currentData.server.status);
  if (connectionPending.action === 'connect' && !connected) {
    return 'connect';
  }
  if (connectionPending.action === 'disconnect' && connected) {
    return 'disconnect';
  }
  return null;
}

export interface ServerDetailViewProps {
  app: UseInfoAppResult;
}

export function ServerDetailView({ app }: ServerDetailViewProps): React.ReactElement {
  const {
    currentData,
    activeTab,
    setActiveTab,
    connectionPending,
    connectServer,
    disconnectServer,
    authorizeServer,
    openEditForm,
    deleteCurrentServer,
    bulkSetTools,
    setToolPreference,
    expandedTools,
    toggleToolExpanded,
    openToolTest,
  } = app;

  if (!currentData?.currentServerId) {
    return <div />;
  }

  const server = currentData.server;
  const serverId = currentData.currentServerId;
  const connected = isServerConnected(server.status);
  const needsAuth = server.status === MCP_STATUS.NeedsAuth;
  const pendingAction = getPendingAction(app);
  const pendingOnCurrent = Boolean(
    connectionPending && connectionPending.serverId === serverId,
  );

  const tools = currentData.serverTools?.[serverId] ?? [];
  const preferences = currentData.toolPreferences?.[serverId] ?? {};
  const prompts = currentData.serverPrompts?.[serverId] ?? [];
  const resources = currentData.serverResources?.[serverId] ?? [];
  const { enabled, total, ratio } = countEnabledTools(tools, preferences);
  const enabledTools = tools.filter((tool) => isToolEnabled(preferences, tool.name));

  const connectionType = server.connectionDetails.connectionType;
  let connectionTypeName: string = connectionType || '未知';
  if (connectionType === 'STDIO') {
    connectionTypeName = 'Stdio';
  } else if (connectionType === 'HTTP') {
    connectionTypeName = 'HTTP';
  }

  let chipVariant = pendingAction ? 'pending' : serverStatusChipVariant(server.status);
  let chipLabel = serverStatusLabel(server.status);
  if (pendingAction === 'connect') {
    chipLabel = '连接中';
  } else if (pendingAction === 'disconnect') {
    chipLabel = '断开中';
  }

  const showAuth = needsAuth || (server.usesOAuth && !connected && !pendingAction);

  const handleConnClick = (): void => {
    if (connectionPending) {
      return;
    }
    if (connected) {
      void disconnectServer(serverId);
    } else if (needsAuth) {
      void authorizeServer(serverId);
    } else {
      void connectServer(serverId);
    }
  };

  const tabs: Array<{ id: InfoTab; label: string; hidden?: boolean; badge?: React.ReactNode }> = [
    { id: 'general', label: '通用' },
    {
      id: 'tools',
      label: '工具',
      hidden: !connected,
      badge: (
        <span
          className={`tab-count${total > 0 && enabled === total ? ' all-on' : ''}${
            total > 0 && enabled > 0 && enabled < total ? ' partial' : ''
          }`}
          id="h-tools-badge"
        >
          <span id="h-tools-ratio">{ratio}</span>
        </span>
      ),
    },
    {
      id: 'prompts',
      label: '提示',
      hidden: !connected,
      badge: <span className="tab-num">{prompts.length}</span>,
    },
    {
      id: 'resources',
      label: '资源',
      hidden: !connected,
      badge: <span className="tab-num">{resources.length}</span>,
    },
  ];

  return (
    <div
      className={`view active v-detail${pendingOnCurrent ? ' is-connection-pending' : ''}`}
      id="v-detail"
    >
      <div className="detail-bar">
        <div className="detail-bar-left">
          <h1 id="h-name">{server.name}</h1>
          <StatusChip label={chipLabel} variant={chipVariant} />
        </div>
        <div className="action-group" data-requires-auth>
          <Button
            variant={connected || needsAuth ? 'secondary' : 'primary'}
            className={pendingAction ? 'is-loading' : undefined}
            isLoading={pendingAction === 'connect' || pendingAction === 'disconnect'}
            disabled={Boolean(connectionPending)}
            onClick={handleConnClick}
          >
            {pendingAction === 'connect'
              ? '连接中…'
              : pendingAction === 'disconnect'
                ? '断开中…'
                : connected
                  ? '断开连接'
                  : needsAuth
                    ? '重新连接'
                    : '连接'}
          </Button>
          {showAuth ? (
            <Button
              variant="primary"
              className={showAuth ? undefined : 'hidden'}
              disabled={Boolean(connectionPending)}
              onClick={() => void authorizeServer(serverId)}
            >
              授权
            </Button>
          ) : null}
          <span className="divider" />
          <Button variant="secondary" onClick={openEditForm}>
            编辑
          </Button>
          <Button variant="danger" onClick={() => void deleteCurrentServer()}>
            删除
          </Button>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`${activeTab === tab.id ? 'active' : ''}${tab.hidden ? ' hidden' : ''}`}
            data-pane={tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.badge ? <span className="tab-meta">{tab.badge}</span> : null}
          </button>
        ))}
      </div>

      <div className="content">
        {activeTab === 'general' ? (
          <div className="pane active" id="pane-general">
            <div className={`info-grid${connected ? '' : ' offline'}`} id="info-grid">
              <div className="card">
                <div className="card-head">标识</div>
                <div className="info-row">
                  <span className="info-label">服务器 ID</span>
                  <span className="info-value mono" id="g-id">
                    {server.id}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">连接方式</span>
                  <span className="info-value" id="g-type">
                    {connectionTypeName}
                  </span>
                </div>
              </div>

              {connected ? (
                <div className="card" id="card-mcp">
                  <div className="card-head">MCP 协议</div>
                  <div className="info-row">
                    <span className="info-label">协议名称</span>
                    <span className="info-value" id="g-internal">
                      {server.internalName || server.name || '—'}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">版本</span>
                    <span className="info-value" id="g-ver">
                      {server.version || '—'}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="card cmd-card">
                <div className="card-head" id="g-cmd-label">
                  {connectionType === 'HTTP' ? '端点 URL' : '启动命令'}
                </div>
                <div className="info-row">
                  <span className="info-value">
                    <div className="code-block" id="g-cmd">
                      {server.connectionDetails.displayCommand || ''}
                    </div>
                  </span>
                </div>
              </div>

              {connected ? (
                <div className="card enabled-tools-card" id="card-enabled-tools">
                  <div className="card-head enabled-tools-head">
                    <span>已启用工具</span>
                    <button
                      type="button"
                      className="enabled-tools-link"
                      onClick={(event) => {
                        event.preventDefault();
                        if (connected) {
                          setActiveTab('tools');
                        }
                      }}
                    >
                      在「工具」Tab 管理 →
                    </button>
                  </div>
                  <div className="enabled-tools-list" id="g-enabled-tools">
                    {!enabledTools.length ? (
                      <div className="card-empty">暂无已启用工具</div>
                    ) : (
                      enabledTools.map((tool) => (
                        <div className="enabled-tool-cell" key={tool.name}>
                          <div className="enabled-tool-head">
                            <span className="enabled-tool-name">{tool.name}</span>
                            {tool.codeName ? (
                              <code className="enabled-tool-fn">{tool.codeName}</code>
                            ) : null}
                          </div>
                          <p className="enabled-tool-desc">{tool.description}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeTab === 'tools' && connected ? (
          <div className="pane active" id="pane-tools">
            <div className="tools-pane">
              <div className="tools-toolbar">
                <p className="tools-toolbar-hint" id="tools-toolbar-hint">
                  已启用 <strong>{ratio}</strong>
                </p>
                <div className="bulk-actions" data-requires-auth>
                  <button type="button" className="bulk-btn" onClick={() => void bulkSetTools(true)}>
                    <IconCheck />
                    全部启用
                  </button>
                  <button
                    type="button"
                    className="bulk-btn bulk-btn-muted"
                    onClick={() => void bulkSetTools(false)}
                  >
                    <IconClose />
                    全部禁用
                  </button>
                </div>
              </div>
              <InfoToolsPanel
                serverId={serverId}
                tools={tools}
                preferences={preferences}
                expandedTools={expandedTools}
                onToggleExpanded={toggleToolExpanded}
                onPreferenceChange={(toolName, enabled) =>
                  void setToolPreference(toolName, enabled)
                }
                onTestTool={(tool) => openToolTest({ serverId, tool })}
              />
            </div>
          </div>
        ) : null}

        {activeTab === 'prompts' && connected ? (
          <div className="pane active" id="pane-prompts">
            <InfoResourcesPanel kind="prompts" items={prompts} serverId={serverId} />
          </div>
        ) : null}

        {activeTab === 'resources' && connected ? (
          <div className="pane active" id="pane-resources">
            <InfoResourcesPanel kind="resources" items={resources} serverId={serverId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
