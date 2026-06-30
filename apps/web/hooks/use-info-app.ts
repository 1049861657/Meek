'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { confirmModal } from '@/components/ui/confirm-dialog';
import { showToast } from '@/components/ui/toast';
import { isUnauthorizedError, showApiError } from '@/lib/api/fetch-json';
import {
  addServer,
  connectServer as connectServerApi,
  deleteServerApi,
  disconnectServer as disconnectServerApi,
  fetchInfoData,
  reloadServerConfig as reloadServerConfigApi,
  saveToolPreferences,
  startOAuthAuthorization,
  switchServer as switchServerApi,
  updateServer,
} from '@/lib/info/info-api';
import { isServerConnected, MCP_STATUS } from '@/lib/info/mcp-status';
import type {
  ConnectionPending,
  ConnectionType,
  InfoData,
  InfoTab,
  InfoView,
  ServerFormState,
  ServerInfo,
  ToolTestTarget,
} from '@/lib/info/types';

const DEFAULT_FORM: ServerFormState = {
  mode: 'add',
  serverId: '',
  name: '',
  connectionType: 'STDIO',
  command: '',
  args: '',
  mcpUrl: '',
  headers: [],
};

function resolveServerStatus(data: InfoData, serverId: string): string {
  const row = data.availableServers?.find((item) => item.id === serverId);
  return row?.status ?? data.server.status;
}

function serverToForm(server: ServerInfo): ServerFormState {
  const connectionType = server.connectionDetails.connectionType as ConnectionType;
  const headers = server.connectionDetails.headers
    ? Object.entries(server.connectionDetails.headers).map(([key, value]) => ({
        key,
        value,
      }))
    : [];

  return {
    mode: 'edit',
    serverId: server.id,
    name: server.name,
    connectionType,
    command: server.connectionDetails.command ?? '',
    args: server.connectionDetails.args ?? '',
    mcpUrl: server.connectionDetails.mcpUrl ?? '',
    headers,
  };
}

function headersToRecord(
  headers: Array<{ key: string; value: string }>,
): Record<string, string> | undefined {
  const result: Record<string, string> = {};
  for (const row of headers) {
    const key = row.key.trim();
    const value = row.value.trim();
    if (key) {
      result[key] = value;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/** Guest 只读：不调用 switch 写接口，用列表行合并当前详情（对齐 MCP-Client selectServerViewLocally） */
function mergeLocalServerSelection(data: InfoData, serverId: string): InfoData | null {
  const server = data.availableServers?.find((item) => item.id === serverId);
  if (!server) {
    return null;
  }
  return {
    ...data,
    currentServerId: serverId,
    server,
  };
}

function formToPayload(form: ServerFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: form.name.trim(),
    connectionType: form.connectionType,
  };

  if (form.connectionType === 'STDIO') {
    payload.command = form.command.trim();
    payload.args = form.args
      .split(',')
      .map((arg) => arg.trim())
      .filter(Boolean);
  } else {
    payload.mcpUrl = form.mcpUrl.trim();
    payload.headers = headersToRecord(form.headers) ?? {};
  }

  return payload;
}

export interface UseInfoAppResult {
  loading: boolean;
  loadError: string | null;
  shellReady: boolean;
  currentData: InfoData | null;
  view: InfoView;
  activeTab: InfoTab;
  searchQuery: string;
  connectionPending: ConnectionPending | null;
  formState: ServerFormState;
  expandedTools: Set<number>;
  testTarget: ToolTestTarget | null;
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: InfoTab) => void;
  toggleToolExpanded: (index: number) => void;
  resetExpandedTools: () => void;
  refreshList: () => Promise<void>;
  selectServer: (serverId: string) => Promise<void>;
  connectServer: (serverId: string) => Promise<void>;
  disconnectServer: (serverId: string) => Promise<void>;
  authorizeServer: (serverId: string) => Promise<void>;
  openAddForm: () => void;
  openEditForm: () => void;
  closeForm: () => void;
  updateForm: (patch: Partial<ServerFormState>) => void;
  addHeaderRow: () => void;
  updateHeaderRow: (index: number, patch: Partial<{ key: string; value: string }>) => void;
  removeHeaderRow: (index: number) => void;
  submitForm: () => Promise<void>;
  deleteCurrentServer: () => Promise<void>;
  setToolPreference: (toolName: string, enabled: boolean) => Promise<void>;
  bulkSetTools: (enabled: boolean) => Promise<void>;
  openToolTest: (target: ToolTestTarget) => void;
  closeToolTest: () => void;
  retryLoad: () => void;
}

export function useInfoApp(): UseInfoAppResult {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shellReady, setShellReady] = useState(false);
  const [currentData, setCurrentData] = useState<InfoData | null>(null);
  const [view, setView] = useState<InfoView>('empty');
  const [activeTab, setActiveTab] = useState<InfoTab>('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionPending, setConnectionPending] = useState<ConnectionPending | null>(null);
  const [formState, setFormState] = useState<ServerFormState>(DEFAULT_FORM);
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());
  const [testTarget, setTestTarget] = useState<ToolTestTarget | null>(null);
  const oauthHandled = useRef(false);

  const applyPageInfo = useCallback((data: InfoData, options?: { initialTab?: InfoTab }) => {
    setCurrentData(data);
    setTestTarget(null);
    setExpandedTools(new Set());

    if (data.currentServerId) {
      setView('detail');
      if (options?.initialTab) {
        setActiveTab(options.initialTab);
      } else if (!isServerConnected(data.server.status)) {
        setActiveTab('general');
      }
    } else {
      setView('empty');
    }

    setLoading(false);
    setLoadError(null);
    setShellReady(true);
  }, []);

  const applyLocalServerSwitch = useCallback(
    (base: InfoData, serverId: string, options?: { initialTab?: InfoTab }): boolean => {
      const localData = mergeLocalServerSelection(base, serverId);
      if (!localData) {
        return false;
      }
      applyPageInfo(localData, options?.initialTab ? { initialTab: options.initialTab } : undefined);
      return true;
    },
    [applyPageInfo],
  );

  const resolveDeepLinkTarget = useCallback(
    (data: InfoData): { serverId: string; initialTab?: InfoTab } | null => {
      const urlServerId = searchParams.get('serverId') ?? '';
      const urlTab = searchParams.get('tab') ?? '';
      const servers = data.availableServers ?? [];

      let serverId: string | null = null;
      if (urlServerId && servers.some((server) => server.id === urlServerId)) {
        serverId = urlServerId;
      } else if (data.currentServerId) {
        serverId = data.currentServerId;
      } else {
        serverId = servers[0]?.id ?? null;
      }

      if (!serverId) {
        return null;
      }

      const server =
        data.currentServerId === serverId && data.server.id === serverId
          ? data.server
          : servers.find((item) => item.id === serverId);
      const initialTab =
        urlTab === 'tools' && server && isServerConnected(server.status) ? ('tools' as const) : undefined;

      return { serverId, ...(initialTab ? { initialTab } : {}) };
    },
    [searchParams],
  );

  const loadInfo = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      try {
        if (!silent) {
          setLoading(true);
          setLoadError(null);
        }

        const data = await fetchInfoData();
        const servers = data.availableServers ?? [];

        if (servers.length === 0) {
          setCurrentData(data);
          setView('empty');
          setLoading(false);
          setShellReady(true);
          return;
        }

        const target = resolveDeepLinkTarget(data);
        if (!target) {
          setCurrentData(data);
          setView('empty');
          setLoading(false);
          setShellReady(true);
          return;
        }

        let pageData = data;
        if (data.currentServerId !== target.serverId) {
          try {
            pageData = await switchServerApi(target.serverId);
          } catch (error) {
            if (isUnauthorizedError(error)) {
              const switched = applyLocalServerSwitch(
                data,
                target.serverId,
                target.initialTab ? { initialTab: target.initialTab } : undefined,
              );
              if (!switched) {
                applyPageInfo(data);
              }
              return;
            }
            throw error;
          }
        }

        applyPageInfo(pageData, target.initialTab ? { initialTab: target.initialTab } : undefined);
      } catch (error) {
        const message = error instanceof Error ? error.message : '获取服务信息失败';
        setLoadError(message);
        setLoading(false);
        setShellReady(false);
      }
    },
    [applyPageInfo, applyLocalServerSwitch, resolveDeepLinkTarget],
  );

  useEffect(() => {
    if (oauthHandled.current) {
      return;
    }
    oauthHandled.current = true;

    const oauth = searchParams.get('oauth');
    if (oauth === 'ok') {
      showToast('OAuth 授权成功', 'success');
    } else if (oauth === 'error') {
      const message = searchParams.get('message') || 'OAuth 授权失败';
      showToast(message, 'error', 8000);
    }

    if (oauth) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('oauth');
      params.delete('message');
      const query = params.toString();
      const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}`;
      window.history.replaceState({}, '', nextUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  const refreshList = useCallback(async () => {
    try {
      setLoading(true);
      const data = await reloadServerConfigApi();
      applyPageInfo(data);
    } catch (error) {
      showApiError(error, '重新加载配置失败');
      await loadInfo({ silent: true });
    }
  }, [applyPageInfo, loadInfo]);

  const selectServer = useCallback(
    async (serverId: string) => {
      setTestTarget(null);
      setExpandedTools(new Set());
      try {
        setLoading(true);
        const data = await switchServerApi(serverId);
        applyPageInfo(data);
      } catch (error) {
        if (isUnauthorizedError(error)) {
          if (currentData) {
            applyLocalServerSwitch(currentData, serverId);
          } else {
            setLoading(false);
          }
          return;
        }
        const message = error instanceof Error ? error.message : '切换服务器失败';
        setLoadError(message);
        setLoading(false);
      }
    },
    [applyLocalServerSwitch, applyPageInfo, currentData],
  );

  const connectServer = useCallback(
    async (serverId: string) => {
      if (connectionPending) {
        return;
      }

      setConnectionPending({ serverId, action: 'connect' });
      try {
        const data = await connectServerApi(serverId);
        const status = resolveServerStatus(data, serverId);

        if (!isServerConnected(status)) {
          if (status === MCP_STATUS.NeedsAuth) {
            applyPageInfo(data);
            showToast('该服务器需要 OAuth 授权，请点击「授权」', 'info', 6000);
            return;
          }
          throw new Error('服务器连接未成功建立');
        }

        applyPageInfo(data);
      } catch (error) {
        showApiError(error, '连接服务器失败');
      } finally {
        setConnectionPending(null);
      }
    },
    [applyPageInfo, connectionPending],
  );

  const disconnectServer = useCallback(
    async (serverId: string) => {
      if (connectionPending) {
        return;
      }

      setConnectionPending({ serverId, action: 'disconnect' });
      try {
        const data = await disconnectServerApi(serverId);
        applyPageInfo(data);
      } catch (error) {
        showApiError(error, '断开服务器连接失败');
      } finally {
        setConnectionPending(null);
      }
    },
    [applyPageInfo, connectionPending],
  );

  const authorizeServer = useCallback(async (serverId: string) => {
    try {
      const authorizationUrl = await startOAuthAuthorization(serverId);
      window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
      showToast('已在浏览器打开授权页，完成后将自动回到本页', 'info', 6000);
    } catch (error) {
      showApiError(error, '无法发起 OAuth 授权');
    }
  }, []);

  const openAddForm = useCallback(() => {
    setTestTarget(null);
    setFormState({ ...DEFAULT_FORM, headers: [] });
    setView('form');
  }, []);

  const openEditForm = useCallback(() => {
    if (!currentData?.server) {
      return;
    }
    setTestTarget(null);
    setFormState(serverToForm(currentData.server));
    setView('form');
  }, [currentData?.server]);

  const closeForm = useCallback(() => {
    if (currentData?.currentServerId || (currentData?.availableServers?.length ?? 0) > 0) {
      setView('detail');
    } else {
      setView('empty');
    }
  }, [currentData]);

  const updateForm = useCallback((patch: Partial<ServerFormState>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
  }, []);

  const addHeaderRow = useCallback(() => {
    setFormState((prev) => ({
      ...prev,
      headers: [...prev.headers, { key: '', value: '' }],
    }));
  }, []);

  const updateHeaderRow = useCallback(
    (index: number, patch: Partial<{ key: string; value: string }>) => {
      setFormState((prev) => ({
        ...prev,
        headers: prev.headers.map((row, rowIndex) =>
          rowIndex === index ? { ...row, ...patch } : row,
        ),
      }));
    },
    [],
  );

  const removeHeaderRow = useCallback((index: number) => {
    setFormState((prev) => ({
      ...prev,
      headers: prev.headers.filter((_, rowIndex) => rowIndex !== index),
    }));
  }, []);

  const submitForm = useCallback(async () => {
    const payload = formToPayload(formState);
    try {
      setLoading(true);
      if (formState.mode === 'add') {
        await addServer({
          ...payload,
          serverId: `server-${Date.now()}`,
        });
      } else {
        await updateServer(formState.serverId, payload);
      }
      await refreshList();
    } catch (error) {
      showApiError(error, '操作失败');
      setLoading(false);
      setView('form');
    }
  }, [formState, refreshList]);

  const deleteCurrentServer = useCallback(async () => {
    if (!currentData?.server) {
      return;
    }

    const confirmed = await confirmModal({
      title: '删除确认',
      message: `确定要删除服务器 "${currentData.server.name}" 吗？`,
      confirmLabel: '删除',
      cancelLabel: '取消',
      variant: 'danger',
    });

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);
      await deleteServerApi(currentData.server.id);
      await refreshList();
    } catch (error) {
      showApiError(error, '删除失败');
      setLoading(false);
    }
  }, [currentData?.server, refreshList]);

  const setToolPreference = useCallback(
    async (toolName: string, enabled: boolean) => {
      if (!currentData?.currentServerId) {
        return;
      }

      const serverId = currentData.currentServerId;
      const nextPrefs = {
        ...(currentData.toolPreferences?.[serverId] ?? {}),
        [toolName]: enabled,
      };

      try {
        await saveToolPreferences(serverId, nextPrefs);
        setCurrentData((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            toolPreferences: {
              ...prev.toolPreferences,
              [serverId]: nextPrefs,
            },
          };
        });
      } catch (error) {
        showApiError(error, '保存工具偏好失败');
      }
    },
    [currentData],
  );

  const bulkSetTools = useCallback(
    async (enabled: boolean) => {
      if (!currentData?.currentServerId || !isServerConnected(currentData.server.status)) {
        return;
      }

      const serverId = currentData.currentServerId;
      const tools = currentData.serverTools?.[serverId] ?? [];
      if (!tools.length) {
        return;
      }

      const nextPrefs = { ...(currentData.toolPreferences?.[serverId] ?? {}) };
      for (const tool of tools) {
        nextPrefs[tool.name] = enabled;
      }

      try {
        await saveToolPreferences(serverId, nextPrefs);
        setCurrentData((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            toolPreferences: {
              ...prev.toolPreferences,
              [serverId]: nextPrefs,
            },
          };
        });
      } catch (error) {
        showApiError(error, '保存工具偏好失败');
      }
    },
    [currentData],
  );

  const toggleToolExpanded = useCallback((index: number) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const resetExpandedTools = useCallback(() => {
    setExpandedTools(new Set());
  }, []);

  const openToolTest = useCallback((target: ToolTestTarget) => {
    setTestTarget(target);
  }, []);

  const closeToolTest = useCallback(() => {
    setTestTarget(null);
  }, []);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    void loadInfo();
  }, [loadInfo]);

  return useMemo(
    () => ({
      loading,
      loadError,
      shellReady,
      currentData,
      view,
      activeTab,
      searchQuery,
      connectionPending,
      formState,
      expandedTools,
      testTarget,
      setSearchQuery,
      setActiveTab,
      toggleToolExpanded,
      resetExpandedTools,
      refreshList,
      selectServer,
      connectServer,
      disconnectServer,
      authorizeServer,
      openAddForm,
      openEditForm,
      closeForm,
      updateForm,
      addHeaderRow,
      updateHeaderRow,
      removeHeaderRow,
      submitForm,
      deleteCurrentServer,
      setToolPreference,
      bulkSetTools,
      openToolTest,
      closeToolTest,
      retryLoad,
    }),
    [
      loading,
      loadError,
      shellReady,
      currentData,
      view,
      activeTab,
      searchQuery,
      connectionPending,
      formState,
      expandedTools,
      testTarget,
      toggleToolExpanded,
      resetExpandedTools,
      refreshList,
      selectServer,
      connectServer,
      disconnectServer,
      authorizeServer,
      openAddForm,
      openEditForm,
      closeForm,
      updateForm,
      addHeaderRow,
      updateHeaderRow,
      removeHeaderRow,
      submitForm,
      deleteCurrentServer,
      setToolPreference,
      bulkSetTools,
      openToolTest,
      closeToolTest,
      retryLoad,
    ],
  );
}
