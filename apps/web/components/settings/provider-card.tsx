'use client';

import { Button } from '@/components/ui/button';
import { DropdownSelect } from '@/components/ui/dropdown-select';
import { EmptyState } from '@/components/ui/empty-state';
import { IconEyeOpen, IconEyeSlash } from '@/components/settings/settings-icons';
import type { Provider, ProviderTypeOption } from '@/lib/settings/types';

export interface ProviderCardProps {
  provider: Provider;
  index: number;
  providerTypes: ProviderTypeOption[];
  visible: boolean;
  apiKeyVisible: boolean;
  onUpdate: (patch: Partial<Provider>) => void;
  onCopy: () => void;
  onDelete: () => void;
  onAddModel: () => void;
  onDeleteModel: (modelIndex: number) => void;
  onDefaultModelChange: (modelValue: string) => void;
  onUpdateModel: (modelIndex: number, patch: { value?: string; label?: string }) => void;
  onToggleApiKeyVisibility: () => void;
}

export function ProviderCard({
  provider,
  index,
  providerTypes,
  visible,
  apiKeyVisible,
  onUpdate,
  onCopy,
  onDelete,
  onAddModel,
  onDeleteModel,
  onDefaultModelChange,
  onUpdateModel,
  onToggleApiKeyVisibility,
}: ProviderCardProps): React.ReactElement {
  const typeOptions = providerTypes.map((type) => ({
    value: type.value,
    label: type.label,
  }));

  return (
    <article
      className="provider-card"
      data-index={index}
      style={{ display: visible ? undefined : 'none' }}
    >
      <header className="provider-card-header">
        <div className="provider-card-title-row">
          <h3>{provider.name || '新提供商'}</h3>
          <button
            type="button"
            className="btn-ghost btn-sm copy-provider"
            title="复制到剪贴板"
            aria-label="复制提供商配置"
            onClick={onCopy}
          >
            复制
          </button>
        </div>
        <Button
          variant="danger"
          size="sm"
          className="btn-danger btn-sm delete-provider"
          data-requires-auth
          onClick={onDelete}
        >
          删除
        </Button>
      </header>

      <div className="provider-card-content">
        <section className="form-section">
          <div className="form-section-title">基本信息</div>
          <div className="form-grid">
            <div className="form-row">
              <label htmlFor={`provider-name-${index}`}>提供商名称</label>
              <input
                type="text"
                id={`provider-name-${index}`}
                value={provider.name}
                placeholder="提供商名称"
                onChange={(event) => onUpdate({ name: event.target.value })}
              />
            </div>
            <div className="form-row">
              <label htmlFor={`provider-type-${index}`}>提供商类型</label>
              <DropdownSelect
                id={`provider-type-${index}`}
                className="field-select"
                value={provider.type}
                options={typeOptions}
                onChange={(value) => onUpdate({ type: value })}
              />
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-title">API 配置</div>
          <div className="form-grid">
            <div className="form-row">
              <label htmlFor={`provider-api-url-${index}`}>API URL</label>
              <input
                type="text"
                id={`provider-api-url-${index}`}
                value={provider.apiUrl}
                placeholder="https://api.example.com/v1"
                onChange={(event) => onUpdate({ apiUrl: event.target.value })}
              />
            </div>
            <div className="form-row">
              <label htmlFor={`provider-api-key-${index}`}>API Key</label>
              <div className="api-key-field">
                <input
                  type={apiKeyVisible ? 'text' : 'password'}
                  id={`provider-api-key-${index}`}
                  value={provider.apiKey}
                  placeholder="sk-..."
                  onChange={(event) => onUpdate({ apiKey: event.target.value })}
                />
                <button
                  type="button"
                  className="toggle-password"
                  aria-label={apiKeyVisible ? '隐藏 API Key' : '显示 API Key'}
                  title={apiKeyVisible ? '隐藏' : '显示'}
                  onClick={onToggleApiKeyVisibility}
                >
                  {apiKeyVisible ? <IconEyeSlash /> : <IconEyeOpen />}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-title">模型配置</div>
          <p className="form-section-hint">
            模型 ID 为调用 API 时使用的标识；显示名称仅用于界面展示，留空则与 ID 相同。
          </p>
          <div className="models-table">
            <div className="models-table-head" aria-hidden="true">
              <span className="model-col-default">默认</span>
              <span className="model-col-id">模型 ID</span>
              <span className="model-col-label">显示名称</span>
              <span className="model-col-actions" />
            </div>
            <div className="models-container">
              {provider.models.length > 0 ? (
                provider.models.map((model, modelIndex) => {
                  const isDefault =
                    provider.defaultModel === model.value && Boolean(model.value);
                  return (
                    <div
                      key={`model-${modelIndex}`}
                      className={`model-item${isDefault ? ' default-model' : ''}`}
                      data-model-index={modelIndex}
                    >
                      <div className="model-col-default">
                        <input
                          type="radio"
                          id={`model-default-${index}-${modelIndex}`}
                          name={`default-model-${index}`}
                          value={model.value}
                          checked={isDefault}
                          className="default-model-radio"
                          aria-label="设为默认模型"
                          onChange={() => onDefaultModelChange(model.value)}
                        />
                        <span className={`model-default-badge${isDefault ? '' : ' hidden'}`}>
                          默认
                        </span>
                      </div>
                      <div className="model-col-id">
                        <label
                          className="model-field-label"
                          htmlFor={`model-value-${index}-${modelIndex}`}
                        >
                          模型 ID
                        </label>
                        <input
                          type="text"
                          id={`model-value-${index}-${modelIndex}`}
                          className="model-value-input"
                          placeholder="如 claude-3-opus"
                          value={model.value}
                          onChange={(event) =>
                            onUpdateModel(modelIndex, { value: event.target.value })
                          }
                        />
                      </div>
                      <div className="model-col-label">
                        <label
                          className="model-field-label"
                          htmlFor={`model-label-${index}-${modelIndex}`}
                        >
                          显示名称
                        </label>
                        <input
                          type="text"
                          id={`model-label-${index}-${modelIndex}`}
                          className="model-label-input"
                          placeholder="如 Claude Opus（可选）"
                          value={model.label}
                          onChange={(event) =>
                            onUpdateModel(modelIndex, { label: event.target.value })
                          }
                        />
                      </div>
                      <button
                        type="button"
                        className="delete-model"
                        title="删除模型"
                        aria-label="删除模型"
                        data-requires-auth
                        onClick={() => onDeleteModel(modelIndex)}
                      >
                        &times;
                      </button>
                    </div>
                  );
                })
              ) : (
                <EmptyState message="暂无模型，点击下方按钮添加" variant="compact" />
              )}
            </div>
          </div>
          <button
            type="button"
            className="add-model"
            data-provider-index={index}
            data-requires-auth
            onClick={onAddModel}
          >
            + 添加模型
          </button>
        </section>
      </div>
    </article>
  );
}
