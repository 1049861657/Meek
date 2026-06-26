'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoadingSpinner } from '@/components/page/page-loading-spinner';
import { ProviderCard } from '@/components/settings/provider-card';
import { SettingsSidebar } from '@/components/settings/settings-sidebar';
import { useSettingsApp } from '@/hooks/use-settings-app';
import { SETTINGS_API_GATE_MESSAGE } from '@/lib/settings/settings-api-gate';

export function SettingsPageClient(): React.ReactElement {
  const app = useSettingsApp();
  const {
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
    copyProvider,
    importProvider,
    toggleApiKeyVisibility,
    retryLoad,
  } = app;

  if (loading) {
    return (
      <div className="settings-page">
        <PageLoadingSpinner message="正在加载配置…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="settings-page">
        <div className="settings-error-panel">
          <p>加载配置失败: {loadError}</p>
          <Button variant="primary" onClick={retryLoad}>
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {apiGateActive ? (
        <div className="settings-gate-banner" role="alert">
          {SETTINGS_API_GATE_MESSAGE}
        </div>
      ) : null}

      <SettingsSidebar
        providers={providersData.providers}
        defaultProvider={providersData.defaultProvider}
        providerTypes={providerTypes}
        activeProviderIndex={activeProviderIndex}
        onSelectProvider={setActiveProviderIndex}
        onDefaultProviderChange={(name) => void setDefaultProvider(name)}
        onAddProvider={addProvider}
        onImportProvider={() => void importProvider()}
      />

      <main className="settings-main">
        <div id="providers-container" className="settings-cards" data-auth-readonly>
          {providersData.providers.length > 0 ? (
            providersData.providers.map((provider, index) => (
              <ProviderCard
                key={`provider-card-${index}`}
                provider={provider}
                index={index}
                providerTypes={providerTypes}
                visible={index === activeProviderIndex}
                apiKeyVisible={Boolean(visibleApiKeys[index])}
                onUpdate={(patch) => updateProvider(index, patch)}
                onCopy={() => void copyProvider(index)}
                onDelete={() => void deleteProvider(index)}
                onAddModel={() => addModel(index)}
                onDeleteModel={(modelIndex) => deleteModel(index, modelIndex)}
                onDefaultModelChange={(modelValue) => setDefaultModel(index, modelValue)}
                onUpdateModel={(modelIndex, patch) => updateModel(index, modelIndex, patch)}
                onToggleApiKeyVisibility={() => toggleApiKeyVisibility(index)}
              />
            ))
          ) : (
            <EmptyState
              title="暂无提供商"
              message="请使用侧边栏的「添加提供商」按钮添加您的第一个 AI 提供商"
              variant="default"
            />
          )}
        </div>

        <footer className="settings-action-bar">
          <Button
            id="save-providers"
            variant="primary"
            data-requires-auth
            disabled={providersData.providers.length === 0}
            onClick={() => void saveProviders()}
          >
            保存配置
          </Button>
        </footer>
      </main>
    </div>
  );
}
