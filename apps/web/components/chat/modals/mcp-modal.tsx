'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  OverlayModal,
  OverlayModalBody,
  OverlayModalFooter,
  OverlayModalHeader,
} from '@/components/ui/overlay-modal';
import { EmptyState } from '@/components/ui/empty-state';
import { showToast } from '@/components/ui/toast';
import { buildChatSettingsFromState, saveChatSettings } from '@/lib/chat/chat-settings-storage';
import {
  commitMcpSelection,
  fetchMcpServers,
  isMcpServerEnabled,
  probeMcpServers,
  type McpServerSummary,
} from '@/lib/chat/mcp-selection';

import type { ChatModalProps } from './modal-types';

function serverAccentHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

function serverInitial(name: string): string {
  const trimmed = String(name).trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'M';
}

function formatToolRatio(server: McpServerSummary): string {
  const total = typeof server.toolsTotal === 'number' ? server.toolsTotal : 0;
  if (server.isConnected !== true && total === 0) {
    return '—';
  }
  const enabled = typeof server.toolsEnabled === 'number' ? server.toolsEnabled : 0;
  return `${enabled}/${total}`;
}

export function McpModal({ open, onClose, internals }: ChatModalProps): React.ReactElement {
  const orchestrator = internals.orchestratorRef.current;
  const [servers, setServers] = useState<McpServerSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadServers = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await fetchMcpServers();
      setServers(data.servers);
      if (orchestrator) {
        setSelectedIds([...orchestrator.state.enabledServerIds]);
      }
    } catch {
      setServers([]);
    } finally {
      setLoading(false);
    }
  }, [orchestrator]);

  useEffect(() => {
    if (open) {
      void loadServers();
    }
  }, [loadServers, open]);

  const toggleServer = (serverId: string): void => {
    setSelectedIds((prev) =>
      prev.includes(serverId) ? prev.filter((id) => id !== serverId) : [...prev, serverId]
    );
  };

  const handleSave = async (): Promise<void> => {
    if (!orchestrator) {
      return;
    }
    setSaving(true);
    try {
      let reachableIds: string[] = [];
      let unreachableNames: string[] = [];
      let skippedNoToolsNames: string[] = [];

      if (selectedIds.length > 0) {
        showToast('正在检测 MCP 连通性…', 'info');
        const probeResult = await probeMcpServers(selectedIds);
        reachableIds = Array.isArray(probeResult.reachableIds)
          ? probeResult.reachableIds.filter((id): id is string => typeof id === 'string')
          : [];
        unreachableNames = Array.isArray(probeResult.unreachable)
          ? probeResult.unreachable.map((row) => row.name || row.id)
          : [];
        skippedNoToolsNames = Array.isArray(probeResult.skippedNoTools)
          ? probeResult.skippedNoTools.map((row) => row.name || row.id)
          : [];
      }

      const committed = commitMcpSelection(reachableIds, servers);
      orchestrator.state.enabledServerIds = committed;
      orchestrator.state.mcpServers = servers;
      saveChatSettings(buildChatSettingsFromState(orchestrator.state));
      internals.syncMcpCounter();

      let message = `已保存 MCP 选择，当前可用 ${committed.length} 个`;
      if (unreachableNames.length > 0) {
        message += `（${unreachableNames.join('、')} 连接不上，已取消勾选）`;
      }
      if (skippedNoToolsNames.length > 0) {
        message += `（${skippedNoToolsNames.join('、')} 无启用工具，已取消勾选）`;
      }
      showToast(message, 'info');
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '保存失败';
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      modalId="mcp-servers-modal"
      className="chat-modal mcp-modal"
      panelClassName="chat-modal-panel mcp-modal-panel"
    >
      <OverlayModalHeader title="MCP 服务器" onClose={onClose} />
      <OverlayModalBody className="mcp-modal-body">
        <div className="mcp-modal-actions">
          <div className="mcp-action-group">
            <button
              type="button"
              className="mcp-action-chip mcp-action-chip--select"
              onClick={() => setSelectedIds(servers.map((server) => server.id))}
            >
              全选
            </button>
            <button
              type="button"
              className="mcp-action-chip mcp-action-chip--clear"
              onClick={() => setSelectedIds([])}
            >
              取消全选
            </button>
          </div>
        </div>
        <div className="mcp-server-list">
          {loading ? (
            <EmptyState message="加载中…" variant="inline" />
          ) : servers.length === 0 ? (
            <p className="mcp-servers-empty">
              暂无已启用的 MCP 服务
              <br />
              请先在 <a href="/info">MCP服务</a> 页连接并启用 MCP
            </p>
          ) : (
            servers.map((server) => {
              const checked = isMcpServerEnabled(selectedIds, server.id);
              const noneEnabled =
                (server.toolsTotal ?? 0) > 0 && (server.toolsEnabled ?? 0) === 0;
              return (
                <div
                  key={server.id}
                  className={`mcp-server-item${noneEnabled ? ' has-no-tools-enabled' : ''}`}
                  style={{ ['--mcp-hue' as string]: String(serverAccentHue(server.name ?? '')) }}
                >
                  <label className="mcp-server-select">
                    <input
                      type="checkbox"
                      className="mcp-server-checkbox"
                      checked={checked}
                      onChange={() => toggleServer(server.id)}
                    />
                    <span className="mcp-server-badge" aria-hidden="true">
                      {serverInitial(server.name ?? '')}
                    </span>
                    <span className="mcp-server-text">
                      <span className="mcp-server-name-row">
                        <span className="mcp-server-name">{server.name}</span>
                      </span>
                      {server.description ? (
                        <span className="mcp-server-desc">{server.description}</span>
                      ) : null}
                      {noneEnabled ? (
                        <span className="mcp-server-warn">尚未启用任何工具</span>
                      ) : null}
                    </span>
                  </label>
                  <a
                    className="mcp-server-tools-link"
                    href={`/info?serverId=${encodeURIComponent(server.id)}&tab=tools`}
                    title="在 MCP 服务页配置工具"
                  >
                    {formatToolRatio(server)}
                  </a>
                </div>
              );
            })
          )}
        </div>
        <OverlayModalFooter className="mcp-modal-footer">
          <button type="button" className="mcp-footer-btn mcp-footer-btn--ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="mcp-footer-btn mcp-footer-btn--save"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            保存
          </button>
        </OverlayModalFooter>
      </OverlayModalBody>
    </OverlayModal>
  );
}
