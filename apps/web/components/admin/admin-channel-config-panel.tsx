'use client';

import { useEffect, useMemo, useState } from 'react';
import { DropdownSelect } from '@/components/ui/dropdown-select';
import { ToggleSwitch } from '@/components/ui/toggle';
import {
  MCP_ICON_TONES,
  PERM_OPTIONS,
  TOOL_PROMPT_MAX_LENGTH,
} from '@/lib/admin/constants';
import {
  applyAccountDefaultsToForm,
  buildModelOptions,
  clampMaxToolCallRounds,
  formatToolPromptCharCount,
  mcpNameInitial,
  profileToFormPayload,
  resolveSelectedModel,
} from '@/lib/admin/channel-config';
import type {
  ChannelConfigFormPayload,
  ChannelConfigState,
  ChannelKey,
  PermissionMode,
} from '@/lib/admin/types';
import { IconConfig } from './admin-icons';

export interface AdminChannelConfigPanelProps {
  channel: ChannelKey;
  configState: ChannelConfigState | null;
  formInit?: 'profile' | 'accountDefaults';
  loading: boolean;
  error: string | null;
  flashMcpIds: string[];
  okMessage: string | null;
  errMessage: string | null;
  writeDisabled: boolean;
  onSave: (form: ChannelConfigFormPayload) => void;
}

export function AdminChannelConfigPanel({
  channel,
  configState,
  formInit = 'profile',
  loading,
  error,
  flashMcpIds,
  okMessage,
  errMessage,
  writeDisabled,
  onSave,
}: AdminChannelConfigPanelProps): React.ReactElement {
  const [form, setForm] = useState<ChannelConfigFormPayload | null>(null);

  useEffect(() => {
    if (configState) {
      setForm(
        formInit === 'accountDefaults'
          ? applyAccountDefaultsToForm(configState)
          : profileToFormPayload(configState),
      );
    } else {
      setForm(null);
    }
  }, [configState, formInit]);

  const providers = configState?.resources.providers ?? [];
  const mcpServers = configState?.resources.mcpServers ?? [];

  const activeProvider = useMemo(() => {
    if (!form) return undefined;
    return providers.find((p) => p.name === form.vendor);
  }, [form, providers]);

  const modelOptions = useMemo(() => {
    return buildModelOptions(activeProvider, form?.defaultModel);
  }, [activeProvider, form?.defaultModel]);

  const compactModelOptions = useMemo(() => {
    return buildModelOptions(activeProvider, form?.compactModel ?? form?.defaultModel);
  }, [activeProvider, form?.compactModel, form?.defaultModel]);

  if (loading || !configState) {
    return (
      <section className="panel" data-channel-config-panel data-config-loading>
        <div className="panel__body text-sm text-[var(--color-text-muted)]">
          {error ?? '加载配置中…'}
        </div>
      </section>
    );
  }

  if (!form) {
    return (
      <section className="panel" data-channel-config-panel>
        <div className="panel__body text-sm text-[var(--color-text-muted)]">加载配置中…</div>
      </section>
    );
  }

  const poolEmpty =
    providers.length === 0 ? (
      <p className="channel-config-empty">
        绑定账号尚未配置 AI 供应商，请先在「模型配置」中配置。
      </p>
    ) : null;

  const updateForm = (patch: Partial<ChannelConfigFormPayload>): void => {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const onVendorChange = (vendor: string): void => {
    const provider = providers.find((p) => p.name === vendor);
    setForm((prev) => {
      if (!prev) return prev;
      const defaultModel = resolveSelectedModel(provider, prev.defaultModel);
      const compactModel = resolveSelectedModel(provider, prev.compactModel ?? defaultModel);
      return { ...prev, vendor, defaultModel, compactModel };
    });
  };

  const toggleMcp = (mcpId: string): void => {
    if (!form.enableTools) return;
    setForm((prev) => {
      if (!prev) return prev;
      const set = new Set(prev.mcpServerIds);
      if (set.has(mcpId)) {
        set.delete(mcpId);
      } else {
        set.add(mcpId);
      }
      return { ...prev, mcpServerIds: [...set] };
    });
  };

  const fillDefaults = (): void => {
    if (!configState) return;
    setForm(applyAccountDefaultsToForm(configState));
  };

  return (
    <section className="panel" data-channel-config-panel>
      <header className="panel__head">
        <span className="panel__icon panel__icon--config" aria-hidden="true">
          <IconConfig />
        </span>
        <div className="panel__head-main">
          <h2 className="panel__title">渠道运行配置</h2>
          <p className="panel__desc">
            自定义本渠道的模型、工具与安全策略；保存后仅对本渠道生效。
          </p>
        </div>
      </header>
      <div className="panel__body channel-config-body">
        {poolEmpty}
        <div className="channel-config-bento">
          <div className="channel-config-zone">
            <h3 className="channel-config-zone__title">对话模型</h3>
            <div className="channel-config-model-grid">
              <div className="channel-config-field">
                <label className="field-label">供应商</label>
                <DropdownSelect
                  value={form.vendor ?? ''}
                  disabled={providers.length === 0}
                  options={providers.map((p) => ({ value: p.name, label: p.name }))}
                  onChange={onVendorChange}
                />
              </div>
              <div className="channel-config-field">
                <label className="field-label">模型</label>
                <DropdownSelect
                  value={form.defaultModel}
                  disabled={providers.length === 0}
                  options={modelOptions}
                  onChange={(value) => updateForm({ defaultModel: value })}
                />
              </div>
              <div className="channel-config-field">
                <label className="field-label">温度</label>
                <input
                  type="number"
                  className="field-input channel-cfg-temperature"
                  step="0.1"
                  min={0}
                  max={2}
                  value={form.temperature}
                  onChange={(e) => updateForm({ temperature: Number(e.target.value) })}
                />
              </div>
              <div className="channel-config-field">
                <label className="field-label">最大输出</label>
                <input
                  type="number"
                  className="field-input channel-cfg-max-tokens"
                  min={1}
                  step={1}
                  value={form.maxTokens}
                  onChange={(e) => updateForm({ maxTokens: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="channel-config-zone channel-config-zone--compact">
            <h3 className="channel-config-zone__title">上下文管理</h3>
            <div className="channel-config-context-head">
              <span className="field-label">压缩模型</span>
            </div>
            <div className="channel-config-context-row">
              <div className="channel-config-context-chip">
                <span className="channel-config-context-chip__label">自动压缩</span>
                <ToggleSwitch
                  checked={form.enableAutoCompact}
                  onChange={(checked) => updateForm({ enableAutoCompact: checked })}
                />
              </div>
              <div
                className={`channel-cfg-compact-wrap${form.enableAutoCompact ? '' : ' channel-cfg-compact-wrap--off'}`}
              >
                <DropdownSelect
                  value={form.compactModel ?? form.defaultModel}
                  disabled={!form.enableAutoCompact || providers.length === 0}
                  options={compactModelOptions}
                  onChange={(value) => updateForm({ compactModel: value })}
                />
              </div>
            </div>
            <p className="channel-config-context-foot">
              开启后，系统将根据上下文长度自动压缩历史消息
            </p>
          </div>

          <div className="channel-config-zone channel-config-zone--full">
            <div className="channel-config-zone__head channel-mcp-head">
              <div className="channel-mcp-head__text">
                <h3 className="channel-config-zone__title">MCP 工具</h3>
                <p className="channel-config-zone__hint">选择在本渠道启用的服务，支持多选</p>
              </div>
              <div className="channel-mcp-enable-row">
                <span className="channel-mcp-enable-label">启用 MCP 工具</span>
                <ToggleSwitch
                  checked={form.enableTools}
                  onChange={(checked) =>
                    updateForm({
                      enableTools: checked,
                      mcpServerIds: checked ? form.mcpServerIds : [],
                    })
                  }
                />
              </div>
            </div>
            <div
              className={`channel-mcp-list${form.enableTools ? '' : ' channel-mcp-list--off'}`}
              data-mcp-list
            >
              {mcpServers.length > 0 ? (
                mcpServers.map((server, index) => {
                  const selected = form.enableTools && form.mcpServerIds.includes(server.id);
                  const tone = MCP_ICON_TONES[index % MCP_ICON_TONES.length];
                  const flash = flashMcpIds.includes(server.id);
                  return (
                    <button
                      key={server.id}
                      type="button"
                      className={
                        'channel-mcp-card' +
                        (selected ? ' is-selected' : '') +
                        (form.enableTools ? '' : ' channel-mcp-card--disabled') +
                        (flash ? ' channel-mcp-card--flash-fail' : '')
                      }
                      disabled={!form.enableTools}
                      aria-pressed={selected}
                      data-mcp-id={server.id}
                      onClick={() => toggleMcp(server.id)}
                    >
                      <span
                        className={`channel-mcp-card__icon channel-mcp-card__icon--${tone}`}
                        aria-hidden="true"
                      >
                        {mcpNameInitial(server.name)}
                      </span>
                      <span className="channel-mcp-card__name">{server.name}</span>
                    </button>
                  );
                })
              ) : (
                <p className="channel-config-empty">
                  绑定账号尚未添加 MCP 服务，请先在「MCP 服务」中配置。
                </p>
              )}
            </div>
          </div>

          <div className="channel-config-zone channel-config-zone--full">
            <h3 className="channel-config-zone__title">工具调用</h3>
            <div className="channel-config-strip channel-config-strip--tools">
              <div className="channel-config-tools-row">
                <div className="channel-config-tools-perms">
                  <span className="field-label">工具权限</span>
                  <div className="channel-perm-cards" role="radiogroup" aria-label="工具权限">
                    {PERM_OPTIONS.map((opt) => {
                      const active = form.permissionMode === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className={`channel-perm-card${active ? ' is-selected' : ''}`}
                          aria-pressed={active}
                          onClick={() => updateForm({ permissionMode: opt.value as PermissionMode })}
                        >
                          <span className="channel-perm-card__radio" aria-hidden="true" />
                          <span className="channel-perm-card__title">{opt.label}</span>
                          <span className="channel-perm-card__hint">{opt.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="channel-config-tools-limit">
                  <label className="field-label" htmlFor={`channel-max-rounds-${channel}`}>
                    单轮工具上限
                  </label>
                  <div className="channel-cfg-stepper">
                    <button
                      type="button"
                      className="channel-cfg-stepper__btn"
                      aria-label="减少"
                      onClick={() =>
                        updateForm({
                          maxToolCallRounds: clampMaxToolCallRounds(
                            form.maxToolCallRounds - 1,
                          ),
                        })
                      }
                    >
                      −
                    </button>
                    <input
                      id={`channel-max-rounds-${channel}`}
                      type="number"
                      className="channel-cfg-stepper__input channel-cfg-max-rounds"
                      min={1}
                      max={100}
                      step={1}
                      value={form.maxToolCallRounds}
                      onChange={(e) =>
                        updateForm({
                          maxToolCallRounds: clampMaxToolCallRounds(Number(e.target.value)),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="channel-cfg-stepper__btn"
                      aria-label="增加"
                      onClick={() =>
                        updateForm({
                          maxToolCallRounds: clampMaxToolCallRounds(
                            form.maxToolCallRounds + 1,
                          ),
                        })
                      }
                    >
                      +
                    </button>
                  </div>
                  <p className="channel-config-tools-limit__hint">
                    单轮对话中最多允许调用的工具次数
                  </p>
                </div>
              </div>

              <div
                className="channel-cfg-prompt-card"
                data-account-tool-prompt={configState.accountToolPrompt ?? ''}
              >
                <div className="channel-cfg-prompt-head">
                  <span className="channel-cfg-prompt-title">用户提示词</span>
                  <ToggleSwitch
                    checked={form.enablePrompts}
                    onChange={(checked) => updateForm({ enablePrompts: checked })}
                  />
                </div>
                <div
                  className={`channel-cfg-prompt-editor${form.enablePrompts ? '' : ' channel-cfg-prompt-editor--off'}`}
                >
                  <textarea
                    className="channel-cfg-tool-prompt"
                    rows={5}
                    maxLength={TOOL_PROMPT_MAX_LENGTH}
                    placeholder="可编写本渠道最终注入的提示词，保存后生效"
                    disabled={!form.enablePrompts}
                    value={form.toolPrompt ?? ''}
                    onChange={(e) => updateForm({ toolPrompt: e.target.value })}
                  />
                  <span className="channel-cfg-prompt-count">
                    {formatToolPromptCharCount((form.toolPrompt ?? '').length)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer className="channel-config-actions">
        <div className="channel-config-actions__btns">
          <button
            type="button"
            className="channel-config-btn channel-config-btn--secondary channel-cfg-fill-defaults"
            data-channel={channel}
            disabled={writeDisabled}
            onClick={fillDefaults}
          >
            恢复默认配置
          </button>
          <button
            type="button"
            className="channel-config-btn channel-config-btn--primary channel-cfg-save"
            data-channel={channel}
            disabled={writeDisabled}
            onClick={() => onSave(form)}
          >
            保存配置
          </button>
        </div>
        {okMessage ? (
          <p className="save-feedback save-feedback--ok" data-config-ok={channel}>
            {okMessage}
          </p>
        ) : null}
        {errMessage ? (
          <p className="save-feedback save-feedback--err" data-config-err={channel}>
            {errMessage}
          </p>
        ) : null}
      </footer>
    </section>
  );
}
