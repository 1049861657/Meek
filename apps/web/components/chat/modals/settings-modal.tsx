'use client';

import { useCallback, useEffect, useState } from 'react';

import { ChipGroup } from '@/components/ui/chip-group';
import {
  OverlayModal,
  OverlayModalBody,
  OverlayModalFooter,
  OverlayModalHeader,
} from '@/components/ui/overlay-modal';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Stepper } from '@/components/ui/stepper';
import { ToggleSwitch } from '@/components/ui/toggle';
import { showToast } from '@/components/ui/toast';
import {
  buildChatSettingsFromState,
  DEFAULT_CHAT_SETTINGS,
  saveChatSettings,
} from '@/lib/chat/chat-settings-storage';
import {
  getModelsForProvider,
  resolveCompactModel,
  type ProviderModelOption,
} from '@/lib/chat/config-fetch';
import type { PermissionMode } from '@/lib/chat/storage-contract';
import type { ChatModalId } from '@/hooks/use-chat-stream';

import type { ChatModalProps } from './modal-types';

const PERMISSION_MODE_FOOTNOTES: Record<PermissionMode, string> = {
  open: '除黑名单外自动执行；对话中不询问。',
  interactive: '只读自动放行；其余工具需确认，可本会话记住。',
  locked: '仅只读工具可执行；其余一律拒绝、不询问。',
};

const TOKEN_MIN = 512;
const TOKEN_MAX = 8192;
const TOKEN_STEP = 512;

const TEMP_CHIPS = [
  { value: '0.2', label: '精确 0.2' },
  { value: '0.7', label: '平衡 0.7' },
  { value: '1.0', label: '创意 1.0' },
];

const TOKEN_CHIPS = [
  { value: '1024', label: '1K' },
  { value: '2048', label: '2K' },
  { value: '4096', label: '4K' },
  { value: '8192', label: '8K' },
];

type SettingsTab = 'model' | 'memory' | 'tools' | 'style';

interface SettingsModalProps extends ChatModalProps {
  onOpenModal: (id: ChatModalId) => void;
}

export function SettingsModal({
  open,
  onClose,
  internals,
  onOpenModal,
}: SettingsModalProps): React.ReactElement {
  const orchestrator = internals.orchestratorRef.current;
  const feature = internals.featureConfigRef.current;
  const providerConfig = internals.providerConfigRef.current;
  const sessionStore = internals.sessionStoreRef.current;

  const [tab, setTab] = useState<SettingsTab>('model');
  const [, bump] = useState(0);
  const forceUpdate = useCallback((): void => bump((value) => value + 1), []);

  const state = orchestrator?.state;
  const isAuthed = sessionStore?.isAuthed() ?? false;
  const hindsightEnabled = feature?.hindsightMemoryEnabled === true;
  const memoryModuleEnabled = hindsightEnabled && isAuthed;

  const providers = providerConfig
    ? Object.keys(providerConfig.providers)
    : state?.vendor
      ? [state.vendor]
      : [];
  const currentProvider = state?.vendor ?? providerConfig?.defaultProvider ?? '';
  const models: ProviderModelOption[] = providerConfig
    ? getModelsForProvider(providerConfig.providers, currentProvider)
    : state?.model
      ? [{ value: state.model, label: state.model }]
      : [];

  useEffect(() => {
    if (!open) {
      return;
    }
    setTab('model');
  }, [open]);

  const handleClose = (): void => {
    internals.persistSettings();
    internals.syncMcpCounter();
    onClose();
  };

  const updateState = (updater: () => void): void => {
    updater();
    forceUpdate();
  };

  const resetSettings = (): void => {
    if (!state || !feature) {
      return;
    }
    updateState(() => {
      state.temperature = DEFAULT_CHAT_SETTINGS.temperature;
      state.maxTokens = DEFAULT_CHAT_SETTINGS.maxTokens;
      state.enableMCPTools = DEFAULT_CHAT_SETTINGS.enableMCPTools;
      state.enablePrompts = DEFAULT_CHAT_SETTINGS.enablePrompts;
      state.skipMemory = DEFAULT_CHAT_SETTINGS.skipMemory;
      state.enableMessageHistory = DEFAULT_CHAT_SETTINGS.enableMessageHistory;
      state.messageHistoryCount = DEFAULT_CHAT_SETTINGS.messageHistoryCount;
      state.maxToolCallRounds = DEFAULT_CHAT_SETTINGS.maxToolCallRounds;
      state.permissionMode = DEFAULT_CHAT_SETTINGS.permissionMode;
      state.enabledSystemToolNames = feature.systemToolCatalog.map((tool) => tool.codeName);
    });
    saveChatSettings(buildChatSettingsFromState(state));
    showToast('设置已重置为默认值', 'info');
  };

  if (!state) {
    return (
      <OverlayModal open={open} onClose={onClose} modalId="settings-modal">
        <OverlayModalHeader title="聊天设置" onClose={onClose} />
        <OverlayModalBody>
          <p>配置尚未加载</p>
        </OverlayModalBody>
      </OverlayModal>
    );
  }

  const clampTokens = (value: number): number =>
    Math.min(TOKEN_MAX, Math.max(TOKEN_MIN, Math.round(value / TOKEN_STEP) * TOKEN_STEP));

  return (
    <OverlayModal
      open={open}
      onClose={handleClose}
      modalId="settings-modal"
      className="chat-modal settings-modal"
      panelClassName="settings-modal-panel"
      wide
    >
      <header className="settings-modal-header">
        <div className="settings-header-left">
          <div>
            <h2 className="settings-modal-title">聊天设置</h2>
            <p className="settings-modal-subtitle">配置模型、记忆与工具行为</p>
          </div>
        </div>
        <div className="settings-header-right">
          <span className="settings-model-pill">
            {currentProvider && state.model ? `${currentProvider} · ${state.model}` : '—'}
          </span>
          <button
            type="button"
            className="settings-modal-close"
            aria-label="关闭"
            onClick={handleClose}
          >
            ×
          </button>
        </div>
      </header>

      <div className="settings-modal-body">
        <nav className="settings-nav" role="tablist" aria-label="设置分类">
          {(
            [
              ['model', '对话模型'],
              ['memory', '记忆'],
              ['tools', '工具'],
              ['style', '生成'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`settings-nav-item${tab === id ? ' active' : ''}`}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {tab === 'model' ? (
            <div className="settings-panel active" role="tabpanel">
              <div className="settings-card">
                <div className="settings-card-head">
                  <h3 className="settings-card-title">主模型</h3>
                  <p className="settings-card-desc">决定 AI 回复使用的推理模型。</p>
                </div>
                <div className="settings-card-body settings-card-body--gap">
                  <div className="settings-field-grid">
                    <div className="settings-field-row">
                      <span className="settings-field-label">供应商</span>
                      <select
                        className="field-select settings-select"
                        value={currentProvider}
                        onChange={(event) => {
                          const vendor = event.target.value;
                          updateState(() => {
                            state.vendor = vendor;
                            const nextModels = providerConfig
                              ? getModelsForProvider(providerConfig.providers, vendor)
                              : [];
                            state.model = nextModels[0]?.value ?? '';
                            state.compactModel = resolveCompactModel(
                              providerConfig?.providers ?? {},
                              vendor,
                              state.compactModel
                            );
                          });
                        }}
                      >
                        {providers.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="settings-field-row">
                      <span className="settings-field-label">模型</span>
                      <select
                        className="field-select settings-select"
                        value={state.model}
                        onChange={(event) => {
                          updateState(() => {
                            state.model = event.target.value;
                          });
                        }}
                      >
                        {models.map((model) => (
                          <option key={model.value} value={model.value}>
                            {model.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'memory' ? (
            <div className="settings-panel active" role="tabpanel">
              <div className="settings-card">
                <div className="settings-card-head">
                  <h3 className="settings-card-title">对话记忆</h3>
                  <p className="settings-card-desc">控制请求中携带的历史消息范围。</p>
                </div>
                <div className="settings-card-body">
                  <div className="settings-item">
                    <div className="settings-item-text">
                      <div className="settings-item-title">启用历史消息</div>
                      <div className="settings-item-hint">关闭后每次仅发送当前输入</div>
                    </div>
                    <ToggleSwitch
                      checked={state.enableMessageHistory}
                      onChange={(checked) =>
                        updateState(() => {
                          state.enableMessageHistory = checked;
                        })
                      }
                      aria-label="启用历史消息"
                    />
                  </div>
                  {state.enableMessageHistory ? (
                    <div className="settings-nested">
                      <div className="settings-inline-field">
                        <span className="settings-field-label">保留最近条数</span>
                        <Stepper
                          className="settings-stepper"
                          value={state.messageHistoryCount}
                          min={1}
                          max={50}
                          onChange={(value) =>
                            updateState(() => {
                              state.messageHistoryCount = value;
                            })
                          }
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                className={`settings-card${!memoryModuleEnabled ? ' is-disabled' : ''}`}
                id="settings-hindsight-memory-card"
              >
                <div className="settings-card-head settings-card-head--with-action">
                  <h3 className="settings-card-title">跨会话记忆</h3>
                  <div className="settings-hindsight-head-right">
                    {!memoryModuleEnabled ? (
                      <span className="settings-hindsight-status-text">
                        {!hindsightEnabled ? '未配置' : '登录后可用'}
                      </span>
                    ) : null}
                    {memoryModuleEnabled ? (
                      <button
                        type="button"
                        className="settings-hindsight-debug-link"
                        onClick={() => onOpenModal('memory-debug')}
                      >
                        调试 →
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="settings-card-body">
                  <div className="settings-item">
                    <div className="settings-item-text">
                      <div className="settings-item-title">忽略记忆</div>
                      <div className="settings-item-hint">
                        开启后不注入历史偏好，且本轮结束不写入 Hindsight
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={state.skipMemory}
                      disabled={!memoryModuleEnabled}
                      onChange={(checked) =>
                        updateState(() => {
                          state.skipMemory = checked;
                        })
                      }
                      aria-label="忽略记忆"
                    />
                  </div>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-head">
                  <h3 className="settings-card-title">上下文压缩</h3>
                  <p className="settings-card-desc">上下文过长时自动调用压缩模型生成摘要。</p>
                </div>
                <div className="settings-card-body">
                  <div className="settings-item">
                    <div className="settings-item-text">
                      <div className="settings-item-title">发送前自动摘要</div>
                      <div className="settings-item-hint">超过阈值时在后台压缩历史</div>
                    </div>
                    <ToggleSwitch
                      checked={state.enableAutoCompact}
                      onChange={(checked) =>
                        updateState(() => {
                          state.enableAutoCompact = checked;
                        })
                      }
                      aria-label="发送前自动摘要"
                    />
                  </div>
                  {state.enableAutoCompact ? (
                    <div className="settings-nested">
                      <div className="settings-field-row">
                        <span className="settings-field-label">压缩模型</span>
                        <select
                          className="field-select settings-select"
                          value={state.compactModel}
                          onChange={(event) => {
                            updateState(() => {
                              state.compactModel = event.target.value;
                            });
                          }}
                        >
                          {models.map((model) => (
                            <option key={model.value} value={model.value}>
                              {model.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'tools' ? (
            <div className="settings-panel active" role="tabpanel">
              <div className="settings-card">
                <div className="settings-card-head settings-card-head--with-action">
                  <div className="settings-card-head-text">
                    <h3 className="settings-card-title">工具与 Agent</h3>
                    <p className="settings-card-desc">管理 Agent 可用工具与执行方式。</p>
                  </div>
                  <button
                    type="button"
                    className="settings-text-link settings-card-head-link"
                    onClick={() => onOpenModal('system-tools')}
                  >
                    系统工具 →
                  </button>
                </div>
                <div className="settings-card-body">
                  <div className="settings-item">
                    <div className="settings-item-text">
                      <div className="settings-item-title">启用 MCP 工具</div>
                      <div className="settings-item-hint">仅控制 MCP 服务器工具</div>
                    </div>
                    <ToggleSwitch
                      checked={state.enableMCPTools}
                      onChange={(checked) =>
                        updateState(() => {
                          state.enableMCPTools = checked;
                        })
                      }
                      aria-label="启用 MCP 工具"
                    />
                  </div>
                  <div className="settings-item">
                    <div className="settings-item-text">
                      <div className="settings-item-title">工具调用轮次上限</div>
                      <div className="settings-item-hint">防止无限 tool loop（1–100）</div>
                    </div>
                    <Stepper
                      className="settings-stepper"
                      value={state.maxToolCallRounds}
                      min={1}
                      max={100}
                      onChange={(value) =>
                        updateState(() => {
                          state.maxToolCallRounds = value;
                        })
                      }
                    />
                  </div>
                  <div className="settings-field-row settings-field-row--permission">
                    <span className="settings-field-label">工具执行方式</span>
                    <SegmentedControl
                      className="settings-segmented"
                      value={state.permissionMode}
                      options={[
                        { value: 'open', label: '自动' },
                        { value: 'interactive', label: '确认' },
                        { value: 'locked', label: '只读' },
                      ]}
                      onChange={(mode) =>
                        updateState(() => {
                          state.permissionMode = mode as PermissionMode;
                        })
                      }
                    />
                    <p className="settings-permission-footnote" role="status">
                      {PERMISSION_MODE_FOOTNOTES[state.permissionMode]}
                    </p>
                  </div>
                  <div className="settings-item">
                    <div className="settings-item-text">
                      <div className="settings-item-title">用户提示词</div>
                      <div className="settings-item-hint">
                        开启后才会把本页编辑的提示词发给模型
                      </div>
                    </div>
                    <ToggleSwitch
                      checked={state.enablePrompts}
                      onChange={(checked) =>
                        updateState(() => {
                          state.enablePrompts = checked;
                        })
                      }
                      aria-label="用户提示词"
                    />
                  </div>
                  <div className="settings-link-item">
                    <button
                      type="button"
                      className="settings-text-link"
                      onClick={() => onOpenModal('prompts')}
                    >
                      编辑提示词 →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {tab === 'style' ? (
            <div className="settings-panel active" role="tabpanel">
              <div className="settings-card">
                <div className="settings-card-head">
                  <h3 className="settings-card-title">生成参数</h3>
                  <p className="settings-card-desc">控制回复风格、长度与输出方式。</p>
                </div>
                <div className="settings-card-body settings-card-body--gap">
                  <div className="settings-slider-block">
                    <div className="settings-slider-meta">
                      <span className="settings-field-label">温度</span>
                      <span className="settings-slider-value">{state.temperature.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      step={1}
                      value={Math.round(state.temperature * 10)}
                      onChange={(event) => {
                        const value = parseInt(event.target.value, 10) / 10;
                        updateState(() => {
                          state.temperature = value;
                        });
                      }}
                    />
                    <ChipGroup
                      className="settings-chips"
                      options={TEMP_CHIPS}
                      value={state.temperature.toFixed(1)}
                      onChange={(raw) => {
                        const value = parseFloat(raw);
                        if (!Number.isNaN(value)) {
                          updateState(() => {
                            state.temperature = value;
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="settings-tokens-block">
                    <div className="settings-slider-meta">
                      <span className="settings-field-label">最大生成长度</span>
                      <span className="settings-slider-value">
                        {state.maxTokens}
                        <span className="settings-value-unit"> tokens</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={TOKEN_MIN}
                      max={TOKEN_MAX}
                      step={TOKEN_STEP}
                      value={clampTokens(state.maxTokens)}
                      onChange={(event) => {
                        updateState(() => {
                          state.maxTokens = clampTokens(parseInt(event.target.value, 10));
                        });
                      }}
                    />
                    <ChipGroup
                      className="settings-chips"
                      options={TOKEN_CHIPS}
                      value={String(clampTokens(state.maxTokens))}
                      onChange={(raw) => {
                        const value = parseInt(raw, 10);
                        if (!Number.isNaN(value)) {
                          updateState(() => {
                            state.maxTokens = clampTokens(value);
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="settings-field-row settings-field-row--divider">
                    <span className="settings-field-label">响应方式</span>
                    <SegmentedControl
                      className="settings-segmented"
                      value="stream"
                      options={[
                        { value: 'stream', label: '流式输出' },
                        {
                          value: 'regular',
                          label: '一次性返回',
                          disabled: true,
                          title: '暂未维护',
                        },
                      ]}
                      onChange={() => undefined}
                    />
                    <p className="settings-item-hint settings-item-hint--flush">
                      默认流式；非流式暂未开放。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <OverlayModalFooter className="settings-modal-footer">
        <button type="button" className="settings-btn-ghost" onClick={resetSettings}>
          恢复默认
        </button>
        <span className="settings-footer-note">更改在关闭时自动保存</span>
      </OverlayModalFooter>
    </OverlayModal>
  );
}
