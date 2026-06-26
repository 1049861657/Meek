'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { inputDialog } from '@/components/ui/input-dialog';
import { showToast } from '@/components/ui/toast';
import { showApiError } from '@/lib/api/fetch-json';
import {
  fetchChannelConfig,
  fetchChannelStatus,
  fetchAdminRoutes,
  fetchSeedFollow,
  fetchUsers,
  resetUserPassword,
  saveChannelConfig as apiSaveChannelConfig,
  saveSeedFollow,
  setUserRole,
  updateAdminRoute,
} from '@/lib/admin/admin-api';
import { AdminApiGateError, isAdminApiReady, ADMIN_API_GATE_MESSAGE } from '@/lib/admin/admin-api-gate';
import {
  buildChannelConfigSaveNotice,
  getChannelConfigSaveValidationError,
  formPayloadToSaveBody,
} from '@/lib/admin/channel-config';
import {
  CHANNEL_STATUS_POLL_DURATION_MS,
  CHANNEL_STATUS_POLL_INTERVAL_MS,
  CONFIG_RELOAD_DEBOUNCE_MS,
  IM_CHANNELS,
} from '@/lib/admin/constants';
import type {
  AdminTab,
  AdminUser,
  AdminViewMode,
  ChannelConfigCacheEntry,
  ChannelConfigFormPayload,
  ChannelKey,
  ChannelLinkStatus,
  ChannelStatusMap,
  RouteRule,
  SeedFollow,
} from '@/lib/admin/types';
import { SUPERADMIN_ROLE } from '@/lib/auth/constants';
import type { AuthUser } from '@/lib/auth/session';

function linkDotClass(status: ChannelLinkStatus): string {
  if (status === 'connected') return 'channel-link-dot channel-link-dot--ok';
  if (status === 'connecting') return 'channel-link-dot channel-link-dot--pending';
  if (status === 'disconnected') return 'channel-link-dot channel-link-dot--err';
  return 'channel-link-dot channel-link-dot--off';
}

function linkDotTitle(status: ChannelLinkStatus): string {
  if (status === 'connected') return 'SDK 已连接';
  if (status === 'connecting') return 'SDK 连接中';
  if (status === 'disconnected') return 'SDK 连接失败';
  return '未配置凭证';
}

function getWildcardRoute(
  routesByChannel: Record<string, RouteRule[]>,
  channel: ChannelKey,
): RouteRule | undefined {
  const routes = routesByChannel[channel] ?? [];
  return routes.find((r) => r.matchKey === '*');
}

export interface UseAdminAppOptions {
  user: AuthUser | null;
  authLoading: boolean;
  openAuthModal: (options?: { lead?: string; onSuccess?: () => void }) => void;
}

export interface UseAdminAppResult {
  viewMode: AdminViewMode;
  apiGateActive: boolean;
  apiGateMessage: string;
  authError: string | null;
  currentUser: AuthUser | null;
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;
  activeChannel: ChannelKey;
  setActiveChannel: (channel: ChannelKey) => void;
  channelStatus: ChannelStatusMap;
  linkDotClass: (status: ChannelLinkStatus) => string;
  linkDotTitle: (status: ChannelLinkStatus) => string;
  allUsers: AdminUser[];
  seedFollow: SeedFollow;
  routesByChannel: Record<string, RouteRule[]>;
  bindingDraft: Record<string, string | undefined>;
  setBindingDraftValue: (channel: ChannelKey, userId: string) => void;
  resolveBindingUserId: (channel: ChannelKey) => string | null;
  getSavedBoundUserId: (channel: ChannelKey) => string | null;
  usernameById: (userId: string | null) => string | null;
  channelConfigEntry: (channel: ChannelKey) => ChannelConfigCacheEntry | null;
  channelConfigLoading: Record<ChannelKey, boolean>;
  channelConfigError: Record<ChannelKey, string | null>;
  flashMcpIds: Record<ChannelKey, string[]>;
  seedOk: string | null;
  seedErr: string | null;
  bindingFeedback: Record<ChannelKey, { ok: string | null; err: string | null }>;
  configFeedback: Record<ChannelKey, { ok: string | null; err: string | null }>;
  saveSeed: (userId: string) => Promise<void>;
  saveBinding: (channel: ChannelKey) => Promise<void>;
  saveChannelConfig: (
    channel: ChannelKey,
    form: ChannelConfigFormPayload,
    providers: import('@/lib/admin/types').ProviderOption[],
  ) => Promise<void>;
  setRole: (userId: string, role: string) => Promise<void>;
  resetPassword: (userId: string) => Promise<void>;
  reloadWorkspace: () => Promise<void>;
  ensureChannelConfig: (
    channel: ChannelKey,
    options?: { force?: boolean; applyAccountDefaults?: boolean },
  ) => Promise<void>;
  scheduleChannelConfigReload: (channel: ChannelKey) => void;
  onLoginClick: () => void;
}

export function useAdminApp({
  user,
  authLoading,
  openAuthModal,
}: UseAdminAppOptions): UseAdminAppResult {
  const [viewMode, setViewMode] = useState<AdminViewMode>('loading');
  const [apiGateActive, setApiGateActive] = useState(!isAdminApiReady());
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTabState] = useState<AdminTab>('users');
  const [activeChannel, setActiveChannel] = useState<ChannelKey>('dingtalk');
  const [channelStatus, setChannelStatus] = useState<ChannelStatusMap>({
    dingtalk: 'skipped',
    feishu: 'skipped',
  });
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [seedFollow, setSeedFollow] = useState<SeedFollow>({ userId: null, username: null });
  const [routesByChannel, setRoutesByChannel] = useState<Record<string, RouteRule[]>>({});
  const [bindingDraft, setBindingDraft] = useState<Record<string, string | undefined>>({});
  const [channelConfigByChannel, setChannelConfigByChannel] = useState<
    Record<string, ChannelConfigCacheEntry>
  >({});
  const [channelConfigLoading, setChannelConfigLoading] = useState<
    Record<ChannelKey, boolean>
  >({ dingtalk: false, feishu: false });
  const [channelConfigError, setChannelConfigError] = useState<
    Record<ChannelKey, string | null>
  >({ dingtalk: null, feishu: null });
  const [flashMcpIds, setFlashMcpIds] = useState<Record<ChannelKey, string[]>>({
    dingtalk: [],
    feishu: [],
  });
  const [seedOk, setSeedOk] = useState<string | null>(null);
  const [seedErr, setSeedErr] = useState<string | null>(null);
  const [bindingFeedback, setBindingFeedback] = useState<
    Record<ChannelKey, { ok: string | null; err: string | null }>
  >({
    dingtalk: { ok: null, err: null },
    feishu: { ok: null, err: null },
  });
  const [configFeedback, setConfigFeedback] = useState<
    Record<ChannelKey, { ok: string | null; err: string | null }>
  >({
    dingtalk: { ok: null, err: null },
    feishu: { ok: null, err: null },
  });

  const configDebounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const configRequestGen = useRef<Record<string, number>>({});
  const channelStatusPollId = useRef<ReturnType<typeof setInterval> | null>(null);
  const bootstrapStarted = useRef(false);

  const usernameById = useCallback(
    (userId: string | null): string | null => {
      if (!userId) return null;
      const found = allUsers.find((u) => u.id === userId);
      return found?.username ?? userId.slice(0, 8);
    },
    [allUsers],
  );

  const getSavedBoundUserId = useCallback(
    (channel: ChannelKey): string | null => {
      return getWildcardRoute(routesByChannel, channel)?.boundUserId ?? null;
    },
    [routesByChannel],
  );

  const resolveBindingUserId = useCallback(
    (channel: ChannelKey): string | null => {
      const draftId = bindingDraft[channel];
      if (draftId !== undefined && draftId !== '') {
        return draftId;
      }
      const savedId = getSavedBoundUserId(channel);
      if (savedId) {
        return savedId;
      }
      const fallbackId = seedFollow.userId ?? allUsers[0]?.id ?? null;
      return fallbackId || null;
    },
    [allUsers, bindingDraft, getSavedBoundUserId, seedFollow.userId],
  );

  const stopChannelStatusPoll = useCallback((): void => {
    if (channelStatusPollId.current) {
      clearInterval(channelStatusPollId.current);
      channelStatusPollId.current = null;
    }
  }, []);

  const syncChannelStatus = useCallback(async (): Promise<boolean> => {
    if (!isAdminApiReady()) {
      return false;
    }
    const status = await fetchChannelStatus();
    let changed = false;
    setChannelStatus((prev) => {
      changed = prev.dingtalk !== status.dingtalk || prev.feishu !== status.feishu;
      return changed ? status : prev;
    });
    return changed;
  }, []);

  const hasConnectingChannelStatus = useCallback((): boolean => {
    return IM_CHANNELS.some((ch) => channelStatus[ch.key] === 'connecting');
  }, [channelStatus]);

  const startChannelStatusPoll = useCallback((): void => {
    stopChannelStatusPoll();
    if (!isAdminApiReady()) {
      return;
    }
    const deadline = Date.now() + CHANNEL_STATUS_POLL_DURATION_MS;
    let unchangedStreak = 0;

    const poll = async (): Promise<void> => {
      if (Date.now() > deadline) {
        stopChannelStatusPoll();
        return;
      }
      try {
        const changed = await syncChannelStatus();
        unchangedStreak = changed ? 0 : unchangedStreak + 1;
        if (!hasConnectingChannelStatus() && unchangedStreak >= 2) {
          stopChannelStatusPoll();
        }
      } catch {
        /* 轮询期间忽略瞬时网络错误 */
      }
    };

    channelStatusPollId.current = setInterval(() => {
      void poll();
    }, CHANNEL_STATUS_POLL_INTERVAL_MS);
    void poll();
  }, [hasConnectingChannelStatus, stopChannelStatusPoll, syncChannelStatus]);

  const loadBindingData = useCallback(async (): Promise<Record<string, RouteRule[]>> => {
    if (!isAdminApiReady()) {
      const empty = { dingtalk: [], feishu: [] };
      setRoutesByChannel(empty);
      return empty;
    }
    const rows = await fetchAdminRoutes();
    const next = {
      dingtalk: rows.filter((row) => row.channel === 'dingtalk'),
      feishu: rows.filter((row) => row.channel === 'feishu'),
    };
    setRoutesByChannel(next);
    return next;
  }, []);

  const loadUsersData = useCallback(async (): Promise<void> => {
    if (!isAdminApiReady()) {
      setAllUsers([]);
      setSeedFollow({ userId: null, username: null });
      setRoutesByChannel({ dingtalk: [], feishu: [] });
      return;
    }
    const [users, seed] = await Promise.all([fetchUsers(), fetchSeedFollow()]);
    setAllUsers(users);
    setSeedFollow(seed);
    try {
      await syncChannelStatus();
    } catch {
      /* ignore */
    }
    await loadBindingData();
  }, [loadBindingData, syncChannelStatus]);

  const invalidateChannelConfig = useCallback((channel: ChannelKey): void => {
    setChannelConfigByChannel((prev) => {
      const next = { ...prev };
      delete next[channel];
      return next;
    });
    configRequestGen.current[channel] = (configRequestGen.current[channel] ?? 0) + 1;
  }, []);

  const ensureChannelConfig = useCallback(
    async (
      channel: ChannelKey,
      options: { force?: boolean; applyAccountDefaults?: boolean } = {},
    ): Promise<void> => {
      const { force = false, applyAccountDefaults = false } = options;
      const boundUserId = resolveBindingUserId(channel);
      const cached = channelConfigByChannel[channel];

      if (!force && cached?.state && cached.boundUserId === boundUserId) {
        return;
      }

      if (!isAdminApiReady()) {
        setChannelConfigError((prev) => ({ ...prev, [channel]: null }));
        setChannelConfigLoading((prev) => ({ ...prev, [channel]: false }));
        return;
      }

      const requestGen = (configRequestGen.current[channel] ?? 0) + 1;
      configRequestGen.current[channel] = requestGen;

      setChannelConfigLoading((prev) => ({ ...prev, [channel]: true }));
      setChannelConfigError((prev) => ({ ...prev, [channel]: null }));

      try {
        const configState = await fetchChannelConfig(channel, boundUserId);
        if (configRequestGen.current[channel] !== requestGen) {
          return;
        }
        setChannelConfigByChannel((prev) => ({
          ...prev,
          [channel]: {
            boundUserId,
            state: configState,
            formInit: applyAccountDefaults ? 'accountDefaults' : 'profile',
          },
        }));
      } catch (error) {
        if (configRequestGen.current[channel] !== requestGen) {
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        setChannelConfigError((prev) => ({ ...prev, [channel]: message }));
      } finally {
        if (configRequestGen.current[channel] === requestGen) {
          setChannelConfigLoading((prev) => ({ ...prev, [channel]: false }));
        }
      }
    },
    [channelConfigByChannel, resolveBindingUserId],
  );

  const scheduleChannelConfigReload = useCallback(
    (channel: ChannelKey): void => {
      const prev = configDebounceTimers.current[channel];
      if (prev) {
        clearTimeout(prev);
      }
      configDebounceTimers.current[channel] = setTimeout(() => {
        delete configDebounceTimers.current[channel];
        invalidateChannelConfig(channel);
        void ensureChannelConfig(channel, { force: true, applyAccountDefaults: true });
      }, CONFIG_RELOAD_DEBOUNCE_MS);
    },
    [ensureChannelConfig, invalidateChannelConfig],
  );

  const reloadWorkspace = useCallback(async (): Promise<void> => {
    setApiGateActive(!isAdminApiReady());
    await loadUsersData();
  }, [loadUsersData]);

  const bootstrap = useCallback(async (): Promise<void> => {
    setAuthError(null);
    if (authLoading) {
      setViewMode('loading');
      return;
    }
    if (!user) {
      setViewMode('guest');
      return;
    }
    if (user.role !== SUPERADMIN_ROLE) {
      setViewMode('forbidden');
      return;
    }
    try {
      await reloadWorkspace();
      setViewMode('ready');
      startChannelStatusPoll();
    } catch (error) {
      setViewMode('guest');
      setAuthError(error instanceof Error ? error.message : String(error));
    }
  }, [authLoading, reloadWorkspace, startChannelStatusPoll, user]);

  useEffect(() => {
    if (bootstrapStarted.current && !authLoading) {
      void bootstrap();
      return;
    }
    if (!bootstrapStarted.current) {
      bootstrapStarted.current = true;
      void bootstrap();
    }
  }, [authLoading, bootstrap, user]);

  useEffect(() => {
    return () => {
      stopChannelStatusPoll();
      for (const timer of Object.values(configDebounceTimers.current)) {
        clearTimeout(timer);
      }
    };
  }, [stopChannelStatusPoll]);

  useEffect(() => {
    if (viewMode === 'ready' && activeTab === 'channels') {
      void ensureChannelConfig(activeChannel);
      startChannelStatusPoll();
    }
  }, [activeChannel, activeTab, ensureChannelConfig, startChannelStatusPoll, viewMode]);

  const setActiveTab = useCallback((tab: AdminTab): void => {
    setActiveTabState(tab);
    if (tab === 'channels') {
      startChannelStatusPoll();
    }
  }, [startChannelStatusPoll]);

  const setBindingDraftValue = useCallback(
    (channel: ChannelKey, userId: string): void => {
      setBindingDraft((prev) => ({ ...prev, [channel]: userId }));
      invalidateChannelConfig(channel);
      scheduleChannelConfigReload(channel);
    },
    [invalidateChannelConfig, scheduleChannelConfigReload],
  );

  const saveSeed = useCallback(
    async (userId: string): Promise<void> => {
      setSeedOk(null);
      setSeedErr(null);
      if (!userId) {
        setSeedErr('请选择种子账号');
        return;
      }
      try {
        const result = await saveSeedFollow(userId);
        setSeedFollow(result);
        setSeedOk(`已保存：${result.username ?? userId}`);
        window.setTimeout(() => setSeedOk(null), 3000);
        for (const ch of IM_CHANNELS) {
          invalidateChannelConfig(ch.key);
          if (activeTab === 'channels' && activeChannel === ch.key) {
            void ensureChannelConfig(ch.key, { force: true });
          }
        }
      } catch (error) {
        if (error instanceof AdminApiGateError) {
          showToast(error.message, 'error');
          return;
        }
        setSeedErr(error instanceof Error ? error.message : String(error));
      }
    },
    [activeChannel, activeTab, ensureChannelConfig, invalidateChannelConfig],
  );

  const saveBinding = useCallback(
    async (channel: ChannelKey): Promise<void> => {
      setBindingFeedback((prev) => ({
        ...prev,
        [channel]: { ok: null, err: null },
      }));
      try {
        const boundUserId = resolveBindingUserId(channel);
        if (!boundUserId) {
          setBindingFeedback((prev) => ({
            ...prev,
            [channel]: { ok: null, err: '请选择绑定账号' },
          }));
          return;
        }
        let wildcard = getWildcardRoute(routesByChannel, channel);
        if (!wildcard?.id) {
          const freshRoutes = await loadBindingData();
          wildcard = getWildcardRoute(freshRoutes, channel);
        }
        if (!wildcard?.id) {
          setBindingFeedback((prev) => ({
            ...prev,
            [channel]: { ok: null, err: '通配路由缺失，请刷新页面后重试' },
          }));
          return;
        }
        await updateAdminRoute(wildcard.id, { boundUserId });
        setBindingDraft((prev) => {
          const next = { ...prev };
          delete next[channel];
          return next;
        });
        await loadBindingData();
        const name = usernameById(boundUserId);
        setBindingFeedback((prev) => ({
          ...prev,
          [channel]: { ok: `绑定已保存：${name}`, err: null },
        }));
        window.setTimeout(() => {
          setBindingFeedback((prev) => ({
            ...prev,
            [channel]: { ok: null, err: prev[channel]?.err ?? null },
          }));
        }, 3000);
        invalidateChannelConfig(channel);
        await ensureChannelConfig(channel, { force: true, applyAccountDefaults: true });
      } catch (error) {
        if (error instanceof AdminApiGateError) {
          showToast(error.message, 'error');
          return;
        }
        setBindingFeedback((prev) => ({
          ...prev,
          [channel]: {
            ok: null,
            err: error instanceof Error ? error.message : String(error),
          },
        }));
      }
    },
    [
      ensureChannelConfig,
      invalidateChannelConfig,
      loadBindingData,
      resolveBindingUserId,
      routesByChannel,
      usernameById,
    ],
  );

  const saveChannelConfig = useCallback(
    async (
      channel: ChannelKey,
      form: ChannelConfigFormPayload,
      providers: import('@/lib/admin/types').ProviderOption[],
    ): Promise<void> => {
      setConfigFeedback((prev) => ({
        ...prev,
        [channel]: { ok: null, err: null },
      }));
      setFlashMcpIds((prev) => ({ ...prev, [channel]: [] }));

      const validationMessage = getChannelConfigSaveValidationError(providers, form);
      if (validationMessage) {
        showToast(validationMessage, 'error');
        return;
      }

      try {
        const boundUserId = resolveBindingUserId(channel);
        const result = await apiSaveChannelConfig({
          channel,
          boundUserId,
          ...formPayloadToSaveBody(form),
        });
        await ensureChannelConfig(channel, { force: true });
        const skipped = result.skippedMcpServers ?? [];
        if (skipped.length > 0) {
          setFlashMcpIds((prev) => ({
            ...prev,
            [channel]: skipped.map((s) => s.id),
          }));
          window.setTimeout(() => {
            setFlashMcpIds((prev) => ({ ...prev, [channel]: [] }));
          }, 1400);
        }
        const notice = buildChannelConfigSaveNotice(result);
        showToast(
          notice.message,
          notice.variant,
          notice.variant === 'success' ? 3200 : 5200,
        );
        setConfigFeedback((prev) => ({
          ...prev,
          [channel]: { ok: notice.inline, err: null },
        }));
        window.setTimeout(() => {
          setConfigFeedback((prev) => ({
            ...prev,
            [channel]: { ok: null, err: prev[channel]?.err ?? null },
          }));
        }, 4000);
      } catch (error) {
        if (error instanceof AdminApiGateError) {
          showToast(error.message, 'error');
          return;
        }
        const message = error instanceof Error ? error.message : String(error);
        showToast(message, 'error');
        setConfigFeedback((prev) => ({
          ...prev,
          [channel]: { ok: null, err: message },
        }));
      }
    },
    [ensureChannelConfig, resolveBindingUserId],
  );

  const setRole = useCallback(
    async (userId: string, role: string): Promise<void> => {
      try {
        await setUserRole(userId, role);
        await loadUsersData();
      } catch (error) {
        if (error instanceof AdminApiGateError) {
          showToast(error.message, 'error');
          return;
        }
        showApiError(error);
      }
    },
    [loadUsersData],
  );

  const resetPassword = useCallback(async (userId: string): Promise<void> => {
    const pwd = await inputDialog({
      title: '重置密码',
      message: '输入新密码（至少 8 位）',
      inputType: 'password',
      confirmLabel: '重置',
    });
    if (!pwd) {
      return;
    }
    try {
      await resetUserPassword(userId, pwd);
      showToast('已重置并吊销该用户会话', 'success');
    } catch (error) {
      if (error instanceof AdminApiGateError) {
        showToast(error.message, 'error');
        return;
      }
      showApiError(error);
    }
  }, []);

  const onLoginClick = useCallback((): void => {
    openAuthModal({
      lead: '登录后管理高级配置',
      onSuccess: () => {
        void bootstrap();
      },
    });
  }, [bootstrap, openAuthModal]);

  const channelConfigEntry = useCallback(
    (channel: ChannelKey): ChannelConfigCacheEntry | null => {
      const entry = channelConfigByChannel[channel];
      if (!entry?.state) {
        return null;
      }
      const boundUserId = resolveBindingUserId(channel);
      if (entry.boundUserId !== boundUserId) {
        return null;
      }
      return entry;
    },
    [channelConfigByChannel, resolveBindingUserId],
  );

  return {
    viewMode,
    apiGateActive,
    apiGateMessage: ADMIN_API_GATE_MESSAGE,
    authError,
    currentUser: user,
    activeTab,
    setActiveTab,
    activeChannel,
    setActiveChannel,
    channelStatus,
    linkDotClass,
    linkDotTitle,
    allUsers,
    seedFollow,
    routesByChannel,
    bindingDraft,
    setBindingDraftValue,
    resolveBindingUserId,
    getSavedBoundUserId,
    usernameById,
    channelConfigEntry,
    channelConfigLoading,
    channelConfigError,
    flashMcpIds,
    seedOk,
    seedErr,
    bindingFeedback,
    configFeedback,
    saveSeed,
    saveBinding,
    saveChannelConfig,
    setRole,
    resetPassword,
    reloadWorkspace,
    ensureChannelConfig,
    scheduleChannelConfigReload,
    onLoginClick,
  };
}
