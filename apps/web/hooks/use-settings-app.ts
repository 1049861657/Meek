'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { confirmModal } from '@/components/ui/confirm-dialog';
import { showToast } from '@/components/ui/toast';
import { showApiError } from '@/lib/api/fetch-json';
import {
  cloneProviderForImport,
  parseProviderFromClipboard,
  resolveUniqueProviderName,
  serializeProviderForClipboard,
} from '@/lib/settings/provider-clipboard';
import {
  assertSettingsWriteReady,
  isSettingsApiReady,
  SETTINGS_API_GATE_MESSAGE,
} from '@/lib/settings/settings-api-gate';
import type { ProviderConnectivityStatus } from '@meek/connectivity';
import {
  fetchProviderConnectivityStatus,
  fetchProviderTypes,
  fetchProvidersData,
  getFallbackProviderTypes,
  reloadProvidersConfig,
  saveProvidersData,
  watchProviderConnectivity,
} from '@/lib/settings/settings-api';
import type { ModelEntry, Provider, ProviderTypeOption, ProvidersData } from '@/lib/settings/types';
import { EMPTY_PROVIDERS_DATA } from '@/lib/settings/types';

function createEmptyProvider(defaultType: string): Provider {
  return {
    name: '',
    type: defaultType,
    apiUrl: '',
    apiKey: '',
    defaultModel: '',
    models: [],
  };
}

function normalizeProvidersData(data: ProvidersData): ProvidersData {
  return {
    ...data,
    providers: data.providers.map((provider) => ({
      ...provider,
      name: provider.name.trim(),
      type: provider.type.trim(),
      apiUrl: provider.apiUrl.trim(),
      apiKey: provider.apiKey.trim(),
      models: provider.models
        .map((model) => ({
          value: model.value.trim(),
          label: (model.label || model.value).trim(),
        }))
        .filter((model) => model.value.length > 0)
        .map((model) => ({
          value: model.value,
          label: model.label || model.value,
        })),
    })),
  };
}

export interface UseSettingsAppResult {
  loading: boolean;
  loadError: string | null;
  apiGateActive: boolean;
  providersData: ProvidersData;
  providerTypes: ProviderTypeOption[];
  activeProviderIndex: number;
  visibleApiKeys: Record<number, boolean>;
  setActiveProviderIndex: (index: number) => void;
  updateProvider: (index: number, patch: Partial<Provider>) => void;
  setDefaultProvider: (providerName: string) => Promise<void>;
  addProvider: () => void;
  deleteProvider: (index: number) => Promise<void>;
  addModel: (providerIndex: number) => void;
  deleteModel: (providerIndex: number, modelIndex: number) => void;
  setDefaultModel: (providerIndex: number, modelValue: string) => void;
  updateModel: (
    providerIndex: number,
    modelIndex: number,
    patch: Partial<ModelEntry>,
  ) => void;
  saveProviders: () => Promise<void>;
  savingProviders: boolean;
  connectivityStatus: ProviderConnectivityStatus;
  copyProvider: (index: number) => Promise<void>;
  importProvider: () => Promise<void>;
  toggleApiKeyVisibility: (index: number) => void;
  retryLoad: () => void;
}

export function useSettingsApp(): UseSettingsAppResult {
  const [loading, setLoading] = useState(true);
  const [savingProviders, setSavingProviders] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [apiGateActive, setApiGateActive] = useState(!isSettingsApiReady());
  const [providersData, setProvidersData] = useState<ProvidersData>(EMPTY_PROVIDERS_DATA);
  const [providerTypes, setProviderTypes] = useState<ProviderTypeOption[]>(
    getFallbackProviderTypes(),
  );
  const [activeProviderIndex, setActiveProviderIndex] = useState(0);
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<number, boolean>>({});
  const [connectivityStatus, setConnectivityStatus] = useState<ProviderConnectivityStatus>({
    state: 'idle',
  });

  const refreshConnectivityStatus = useCallback(async (): Promise<void> => {
    if (!isSettingsApiReady()) {
      return;
    }
    try {
      const status = await fetchProviderConnectivityStatus();
      setConnectivityStatus(status);
    } catch (error) {
      console.error('加载连通状态失败:', error);
    }
  }, []);

  const watchConnectivityAfterSave = useCallback((): void => {
    void watchProviderConnectivity(setConnectivityStatus)
      .then((outcome) => {
        if (outcome?.state === 'fail' && outcome.message) {
          showToast(`连通检测失败：${outcome.message}`, 'error');
        }
      })
      .catch((error: unknown) => {
        console.error('连通检测监听失败:', error);
      });
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    if (!isSettingsApiReady()) {
      setApiGateActive(true);
      setProviderTypes(getFallbackProviderTypes());
      setProvidersData(EMPTY_PROVIDERS_DATA);
      setLoading(false);
      return;
    }

    setApiGateActive(false);

    try {
      let types = getFallbackProviderTypes();
      try {
        types = await fetchProviderTypes();
      } catch (error) {
        console.error('加载提供商类型失败:', error);
      }

      const data = await fetchProvidersData();
      setProviderTypes(types.length > 0 ? types : getFallbackProviderTypes());
      setProvidersData(data);
      await refreshConnectivityStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : '加载配置失败';
      setLoadError(message);
      setProviderTypes(getFallbackProviderTypes());
      setProvidersData(EMPTY_PROVIDERS_DATA);
    } finally {
      setLoading(false);
    }
  }, [refreshConnectivityStatus]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    setActiveProviderIndex((prev) => {
      if (providersData.providers.length === 0) {
        return 0;
      }
      if (prev >= providersData.providers.length) {
        return providersData.providers.length - 1;
      }
      return prev;
    });
  }, [providersData.providers.length]);

  const saveAndReload = useCallback(async (data: ProvidersData): Promise<boolean> => {
    assertSettingsWriteReady();
    await saveProvidersData(data);

    try {
      await reloadProvidersConfig();
      return true;
    } catch {
      return false;
    }
  }, []);

  const updateProvider = useCallback((index: number, patch: Partial<Provider>) => {
    setProvidersData((prev) => ({
      ...prev,
      providers: prev.providers.map((provider, providerIndex) =>
        providerIndex === index ? { ...provider, ...patch } : provider,
      ),
    }));
  }, []);

  const setDefaultProvider = useCallback(
    async (providerName: string) => {
      if (apiGateActive) {
        showToast(SETTINGS_API_GATE_MESSAGE, 'info');
        return;
      }

      const nextData = { ...providersData, defaultProvider: providerName };
      setProvidersData(nextData);

      try {
        assertSettingsWriteReady();
        await saveProvidersData(nextData);
        try {
          await reloadProvidersConfig();
        } catch (error) {
          console.warn('重载配置失败:', error);
        }
      } catch (error) {
        showApiError(error, '保存失败');
      }
    },
    [apiGateActive, providersData],
  );

  const addProvider = useCallback(() => {
    if (apiGateActive) {
      showToast(SETTINGS_API_GATE_MESSAGE, 'info');
      return;
    }

    try {
      assertSettingsWriteReady();
    } catch (error) {
      showApiError(error, '操作不可用');
      return;
    }

    const defaultType = providerTypes[0]?.value ?? 'openai';
    setProvidersData((prev) => ({
      ...prev,
      providers: [...prev.providers, createEmptyProvider(defaultType)],
    }));
    setActiveProviderIndex(providersData.providers.length);
    window.scrollTo(0, document.body.scrollHeight);
  }, [apiGateActive, providerTypes, providersData.providers.length]);

  const deleteProvider = useCallback(
    async (index: number) => {
      if (apiGateActive) {
        showToast(SETTINGS_API_GATE_MESSAGE, 'info');
        return;
      }

      const confirmed = await confirmModal({
        title: '删除确认',
        message: '确定要删除这个提供商吗？',
        confirmLabel: '删除',
        cancelLabel: '取消',
        variant: 'danger',
      });

      if (!confirmed) {
        return;
      }

      try {
        assertSettingsWriteReady();
        const deletedName = providersData.providers[index]?.name ?? '';
        const nextProviders = providersData.providers.filter((_, i) => i !== index);
        let nextDefault = providersData.defaultProvider;
        if (nextProviders.length > 0 && nextDefault === deletedName) {
          nextDefault = nextProviders[0]?.name ?? '';
        }

        const nextData: ProvidersData = {
          providers: nextProviders,
          defaultProvider: nextDefault,
        };

        const applied = await saveAndReload(nextData);
        setProvidersData(nextData);
        if (activeProviderIndex >= nextProviders.length) {
          setActiveProviderIndex(Math.max(0, nextProviders.length - 1));
        }
        showToast(
          applied ? '提供商已删除' : '已删除，但需要重启服务器才能应用更改',
          applied ? 'success' : 'error',
        );
      } catch (error) {
        showApiError(error, '删除失败');
      }
    },
    [activeProviderIndex, apiGateActive, providersData, saveAndReload],
  );

  const addModel = useCallback(
    (providerIndex: number) => {
      if (apiGateActive) {
        showToast(SETTINGS_API_GATE_MESSAGE, 'info');
        return;
      }

      setProvidersData((prev) => {
        const providers = prev.providers.map((provider, index) => {
          if (index !== providerIndex) {
            return provider;
          }
          const models = [...(provider.models ?? []), { value: '', label: '' }];
          return {
            ...provider,
            models,
            defaultModel: models.length === 1 ? '' : provider.defaultModel,
          };
        });
        return { ...prev, providers };
      });
    },
    [apiGateActive],
  );

  const deleteModel = useCallback((providerIndex: number, modelIndex: number) => {
    setProvidersData((prev) => {
      const providers = prev.providers.map((provider, index) => {
        if (index !== providerIndex || !provider.models) {
          return provider;
        }

        const removed = provider.models[modelIndex];
        const models = provider.models.filter((_, i) => i !== modelIndex);
        let defaultModel = provider.defaultModel;

        if (removed && defaultModel === removed.value && models.length > 0) {
          defaultModel = models[0]?.value ?? '';
        } else if (models.length === 0) {
          defaultModel = '';
        }

        return { ...provider, models, defaultModel };
      });
      return { ...prev, providers };
    });
  }, []);

  const setDefaultModel = useCallback((providerIndex: number, modelValue: string) => {
    setProvidersData((prev) => ({
      ...prev,
      providers: prev.providers.map((provider, index) =>
        index === providerIndex ? { ...provider, defaultModel: modelValue } : provider,
      ),
    }));
  }, []);

  const updateModel = useCallback(
    (providerIndex: number, modelIndex: number, patch: Partial<ModelEntry>) => {
      setProvidersData((prev) => ({
        ...prev,
        providers: prev.providers.map((provider, index) => {
          if (index !== providerIndex) {
            return provider;
          }
          const models = (provider.models ?? []).map((model, i) =>
            i === modelIndex ? { ...model, ...patch } : model,
          );
          return { ...provider, models };
        }),
      }));
    },
    [],
  );

  const saveProviders = useCallback(async () => {
    if (apiGateActive) {
      showToast(SETTINGS_API_GATE_MESSAGE, 'info');
      return;
    }

    setSavingProviders(true);
    try {
      assertSettingsWriteReady();

      const normalized = normalizeProvidersData(providersData);

      for (const provider of normalized.providers) {
        if (!provider.name || !provider.apiUrl || !provider.apiKey) {
          throw new Error('提供商名称、API URL 和 API Key 不能为空');
        }
      }

      await saveProvidersData(normalized);
      setProvidersData(normalized);
      showToast('配置保存成功', 'success');
      void reloadProvidersConfig().catch((error: unknown) => {
        console.error('重新加载提供商配置失败:', error);
      });
      watchConnectivityAfterSave();
    } catch (error) {
      showApiError(error, '保存配置失败');
    } finally {
      setSavingProviders(false);
    }
  }, [apiGateActive, providersData, watchConnectivityAfterSave]);

  const copyProvider = useCallback(
    async (index: number) => {
      const provider = providersData.providers[index];
      if (!provider) {
        showToast('复制失败：未找到提供商', 'error');
        return;
      }

      try {
        const text = serializeProviderForClipboard(provider);
        await navigator.clipboard.writeText(text);
        showToast('提供商配置已复制到剪贴板', 'success');
      } catch (error) {
        console.error('复制提供商配置失败:', error);
        showToast('复制失败，请检查浏览器剪贴板权限', 'error');
      }
    },
    [providersData.providers],
  );

  const importProvider = useCallback(async () => {
    if (apiGateActive) {
      showToast(SETTINGS_API_GATE_MESSAGE, 'info');
      return;
    }

    try {
      assertSettingsWriteReady();
      const text = await navigator.clipboard.readText();
      const imported = parseProviderFromClipboard(text);
      const existingNames = providersData.providers.map((provider) => provider.name);
      const uniqueName = resolveUniqueProviderName(imported.name, existingNames);
      const provider = cloneProviderForImport(imported);
      provider.name = uniqueName;

      setProvidersData((prev) => ({
        ...prev,
        providers: [...prev.providers, provider],
      }));
      setActiveProviderIndex(providersData.providers.length);
      showToast('已导入提供商，请确认后点击「保存配置」', 'success');
    } catch (error) {
      showApiError(error, '导入失败');
    }
  }, [apiGateActive, providersData.providers]);

  const toggleApiKeyVisibility = useCallback((index: number) => {
    setVisibleApiKeys((prev) => ({ ...prev, [index]: !prev[index] }));
  }, []);

  const retryLoad = useCallback(() => {
    void loadSettings();
  }, [loadSettings]);

  return useMemo(
    () => ({
      loading,
      loadError,
      apiGateActive,
      providersData,
      providerTypes,
      activeProviderIndex,
      visibleApiKeys,
      setActiveProviderIndex,
      updateProvider,
      setDefaultProvider,
      addProvider,
      deleteProvider,
      addModel,
      deleteModel,
      setDefaultModel,
      updateModel,
      saveProviders,
      savingProviders,
      connectivityStatus,
      copyProvider,
      importProvider,
      toggleApiKeyVisibility,
      retryLoad,
    }),
    [
      loading,
      loadError,
      apiGateActive,
      providersData,
      providerTypes,
      activeProviderIndex,
      visibleApiKeys,
      updateProvider,
      setDefaultProvider,
      addProvider,
      deleteProvider,
      addModel,
      deleteModel,
      setDefaultModel,
      updateModel,
      saveProviders,
      savingProviders,
      connectivityStatus,
      copyProvider,
      importProvider,
      toggleApiKeyVisibility,
      retryLoad,
    ],
  );
}
