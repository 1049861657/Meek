'use client';

import { DropdownSelect } from '@/components/ui/dropdown-select';
import type { Provider, ProviderTypeOption } from '@/lib/settings/types';

export interface SettingsSidebarProps {
  providers: Provider[];
  defaultProvider: string;
  providerTypes: ProviderTypeOption[];
  activeProviderIndex: number;
  onSelectProvider: (index: number) => void;
  onDefaultProviderChange: (name: string) => void;
  onAddProvider: () => void;
  onImportProvider: () => void;
}

export function SettingsSidebar({
  providers,
  defaultProvider,
  providerTypes,
  activeProviderIndex,
  onSelectProvider,
  onDefaultProviderChange,
  onAddProvider,
  onImportProvider,
}: SettingsSidebarProps): React.ReactElement {
  const defaultOptions = providers.map((provider) => ({
    value: provider.name,
    label: provider.name || '新提供商',
  }));

  return (
    <aside className="settings-sidebar" aria-label="提供商列表">
      <div className="settings-sidebar-inner">
        <div className="settings-sidebar-label-row">
          <p className="settings-sidebar-label">提供商</p>
          <button
            type="button"
            id="import-provider"
            className="btn-ghost btn-xs"
            title="从剪贴板导入提供商配置"
            data-requires-auth
            onClick={onImportProvider}
          >
            导入
          </button>
        </div>

        <nav id="sidebar-providers-list" className="settings-sidebar-list" role="tablist">
          {providers.map((provider, index) => {
            const initial = (provider.name || '新').charAt(0).toUpperCase();
            const typeLabel =
              providerTypes.find((type) => type.value === provider.type)?.label ||
              provider.type ||
              '未设置类型';
            const isDefault = Boolean(provider.name && provider.name === defaultProvider);
            const displayName = provider.name || '新提供商';

            return (
              <button
                key={`provider-nav-${index}`}
                type="button"
                className={`sidebar-provider-item${index === activeProviderIndex ? ' active' : ''}`}
                data-index={index}
                role="tab"
                aria-selected={index === activeProviderIndex}
                onClick={() => onSelectProvider(index)}
              >
                <span className="provider-icon">{initial}</span>
                <span className="provider-nav-body">
                  <span className="provider-nav-name">{displayName}</span>
                  <span className="provider-nav-meta">{typeLabel}</span>
                </span>
                {isDefault ? <span className="provider-default-tag">默认</span> : null}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          id="add-provider"
          className="settings-add-btn"
          data-requires-auth
          onClick={onAddProvider}
        >
          <span className="settings-add-icon" aria-hidden="true">
            +
          </span>
          添加提供商
        </button>

        <footer className="settings-sidebar-foot" data-auth-readonly>
          <label className="settings-default-label" htmlFor="default-provider">
            默认提供商
          </label>
          <DropdownSelect
            id="default-provider"
            className="field-select settings-default-select"
            value={defaultProvider}
            options={defaultOptions}
            placeholder="请选择"
            disabled={providers.length === 0}
            onChange={onDefaultProviderChange}
          />
        </footer>
      </div>
    </aside>
  );
}
