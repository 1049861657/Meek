'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  OverlayModal,
  OverlayModalBody,
  OverlayModalFooter,
  OverlayModalHeader,
} from '@/components/ui/overlay-modal';
import { showToast } from '@/components/ui/toast';
import { getSession } from '@/lib/auth/session';
import {
  getSelectableMcpServerIds,
  type McpServerSummary,
} from '@/lib/chat/mcp-selection';

import type { ChatModalProps } from './modal-types';

type PreviewMode = 'loading' | 'off' | 'idle' | 'ready' | 'error';

interface AssembledPreview {
  content: string;
  charCount?: number;
}

interface PromptSection {
  key?: string;
  label?: string;
  content?: string;
  source?: string;
  includedInSystem?: boolean;
}

const EMPTY_SECTION_HINTS: Record<string, string> = {
  core: '当前无内容(客户端自己硬编码)',
  skills_catalog: '暂未启用',
};

function PromptSectionIndicator({ variant }: { variant: 'idle' | 'filled' | 'skipped' }): React.ReactElement {
  return (
    <span
      className={`prompt-section-indicator prompt-section-indicator--${variant}`}
      role="status"
      aria-hidden="true"
    />
  );
}

function PromptSectionsList({
  sections,
  loading,
}: {
  sections: PromptSection[];
  loading: boolean;
}): React.ReactElement {
  if (loading) {
    return <div className="prompt-sections-list is-loading">加载中…</div>;
  }
  if (!sections.length) {
    return <div className="prompt-sections-list is-empty" />;
  }

  return (
    <div className="prompt-sections-list">
      {sections.map((section) => {
        const text = (section.content ?? '').trim();
        const label = section.label || section.key || '段';
        if (!text) {
          const hint = section.key ? EMPTY_SECTION_HINTS[section.key] : undefined;
          return (
            <div key={label} className="prompt-section-row">
              <div className="prompt-section-row-main">
                <span className="prompt-section-row-label">{label}</span>
                {hint ? <span className="prompt-section-row-hint">{hint}</span> : null}
              </div>
              <PromptSectionIndicator variant="idle" />
            </div>
          );
        }
        const indicatorVariant = section.includedInSystem === false ? 'skipped' : 'filled';
        return (
          <details key={label} className="prompt-section-item" open={section.includedInSystem !== false}>
            <summary>
              <span className="prompt-section-item-label">{label}</span>
              <PromptSectionIndicator variant={indicatorVariant} />
            </summary>
            <div className="prompt-section-item-body">
              {section.source?.trim() ? (
                <p className="prompt-section-source">{section.source.trim()}</p>
              ) : null}
              <pre className="prompt-section-content">{text}</pre>
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function PromptsModal({ open, onClose, internals }: ChatModalProps): React.ReactElement {
  const orchestrator = internals.orchestratorRef.current;
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>('idle');
  const [assembled, setAssembled] = useState<AssembledPreview | null>(null);
  const [sections, setSections] = useState<PromptSection[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);

  const hasToolsEnabled = useCallback((): boolean => {
    const state = orchestrator?.state;
    if (!state) {
      return false;
    }
    const mcpOn = state.enableMCPTools !== false;
    const systemOn = (state.enabledSystemToolNames ?? []).length > 0;
    return mcpOn || systemOn;
  }, [orchestrator]);

  const buildPreviewParams = useCallback((): URLSearchParams => {
    const state = orchestrator?.state;
    const params = new URLSearchParams({
      enableTools: String(hasToolsEnabled()),
      enablePrompts: String(state?.enablePrompts !== false),
    });
    params.set('toolPrompt', prompt);
    const servers = (state?.mcpServers ?? []) as McpServerSummary[];
    const ids = state ? getSelectableMcpServerIds(state.enabledServerIds, servers) : [];
    if (ids.length > 0) {
      params.set('mcpServerIds', ids.join(','));
    }
    return params;
  }, [hasToolsEnabled, orchestrator, prompt]);

  const loadPrompt = useCallback(async (): Promise<void> => {
    setLoading(true);
    setPreviewMode('loading');
    try {
      const response = await fetch('/api/settings/tool-prompt', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as { prompt?: string };
      setPrompt(data.prompt ?? '');
    } catch {
      setPrompt('');
      showToast('加载提示词失败（Settings API 可能尚未就绪）', 'info');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPreview = useCallback(async (): Promise<void> => {
    if (!hasToolsEnabled()) {
      setPreviewMode('off');
      setAssembled(null);
      setSections([]);
      return;
    }
    setPreviewMode('loading');
    if (sectionsOpen) {
      setSectionsLoading(true);
    }
    try {
      const response = await fetch(
        `/api/settings/system-prompt-sections?${buildPreviewParams()}`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        assembled?: AssembledPreview | null;
        sections?: PromptSection[];
      };
      const next = data.assembled ?? null;
      setSections(Array.isArray(data.sections) ? data.sections : []);
      if (!next?.content?.trim()) {
        setPreviewMode('idle');
        setAssembled(null);
      } else {
        setPreviewMode('ready');
        setAssembled(next);
      }
    } catch {
      setPreviewMode('error');
      setAssembled(null);
      setSections([]);
    } finally {
      setSectionsLoading(false);
    }
  }, [buildPreviewParams, hasToolsEnabled, sectionsOpen]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadPrompt().then(() => loadPreview());
  }, [loadPreview, loadPrompt, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const timer = setTimeout(() => {
      void loadPreview();
    }, 400);
    return () => clearTimeout(timer);
  }, [loadPreview, open, prompt]);

  const handleSave = async (): Promise<void> => {
    try {
      const user = await getSession();
      if (!user) {
        showToast('请先登录后再保存配置', 'info');
        return;
      }
      setSaving(true);
      const response = await fetch('/api/settings/tool-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ prompt }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      showToast('提示词保存成功', 'info');
      onClose();
    } catch {
      showToast('保存提示词失败（Settings API 可能尚未就绪）', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      modalId="prompts-modal"
      className="chat-modal"
      panelClassName="chat-modal-panel chat-modal-panel-wide prompts-modal-panel"
      wide
    >
      <OverlayModalHeader title="编辑用户提示词" onClose={onClose} />
      <OverlayModalBody className="prompts-modal-scroll">
        <section className="prompts-editor-section">
          <label className="prompts-field-label" htmlFor="tool-prompt-content">
            提示词内容
          </label>
          <p className="prompts-field-hint">
            可选。不填则只使用各连接服务自带的服务提示词。
          </p>
          <textarea
            id="tool-prompt-content"
            className="chat-input chat-code-area prompts-textarea"
            rows={8}
            placeholder="如：调用前先说明步骤；敏感操作先确认"
            value={loading ? '加载中…' : prompt}
            disabled={loading || saving}
            onChange={(event) => setPrompt(event.target.value)}
          />
        </section>
        <section
          className={`prompt-assembled-preview${previewMode !== 'ready' ? ' is-collapsed' : ''}`}
          aria-live="polite"
        >
          <div className="prompt-assembled-header">
            <h3 className="prompt-assembled-title">实际提示词</h3>
            <span className={`prompt-assembled-status prompt-assembled-status--${previewMode}`}>
              {previewMode === 'loading'
                ? '加载中'
                : previewMode === 'off'
                  ? '未开启工具'
                  : previewMode === 'idle'
                    ? '暂无提示词'
                    : previewMode === 'error'
                      ? '加载失败'
                      : '有提示词'}
            </span>
            {previewMode === 'ready' && assembled ? (
              <p className="prompt-assembled-meta">
                约 {(assembled.charCount ?? assembled.content.length).toLocaleString()} 字
              </p>
            ) : null}
          </div>
          {previewMode === 'ready' && assembled ? (
            <pre className="prompt-assembled-body">{assembled.content}</pre>
          ) : null}
        </section>
        <details
          className="prompt-sections-preview"
          open={sectionsOpen}
          onToggle={(event) => {
            const openDetails = (event.target as HTMLDetailsElement).open;
            setSectionsOpen(openDetails);
            if (openDetails) {
              void loadPreview();
            }
          }}
        >
          <summary className="prompt-sections-summary">
            <span className="prompt-sections-summary-text">提示词组成</span>
            <span className="prompt-sections-summary-hint">未填写的段不会发给模型</span>
          </summary>
          <PromptSectionsList sections={sections} loading={sectionsLoading} />
        </details>
      </OverlayModalBody>
      <OverlayModalFooter className="prompts-modal-footer">
        <button type="button" className="btn-secondary" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          保存
        </button>
      </OverlayModalFooter>
    </OverlayModal>
  );
}
