'use client';

import { useCallback, useEffect, useState } from 'react';

import { ChatMarkdown } from '@/components/chat/chat-markdown';
import { EmptyState } from '@/components/ui/empty-state';
import { OverlayModal } from '@/components/ui/overlay-modal';
import { Spinner } from '@/components/ui/spinner';
import { showToast } from '@/components/ui/toast';
import type { ApiMessage } from '@/lib/chat/message-history-builder';

import type { ChatModalProps } from './modal-types';

interface ContextPreviewPayload {
  estimatedTokens?: number;
  compactThresholdTokens?: number;
  messageCount?: number;
  pendingAutoCompact?: boolean;
  wouldAutoCompact?: boolean;
  contextOverrideActive?: boolean;
  roleCounts?: Record<string, number>;
  compactedToolCount?: number;
  messages?: Array<{
    role?: string;
    preview?: string;
    charLength?: number;
    estimatedTokens?: number;
    index?: number;
  }>;
}

export function ContextModal({ open, onClose, internals }: ChatModalProps): React.ReactElement {
  const orchestrator = internals.orchestratorRef.current;
  const sessionStore = internals.sessionStoreRef.current;

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<ContextPreviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const state = orchestrator?.state;
  const isContextCompacted = Boolean(
    state?.apiContextOverride?.length || state?.contextCompactedActive
  );
  const hasDraft = Boolean(state?.compactDraft);
  const canClear = Boolean(
    state?.apiContextOverride?.length ||
      state?.contextCompactedActive ||
      state?.compactedBaseline
  );

  const resolveCompactText = (): string => {
    if (!state) {
      return '';
    }
    for (const item of [
      state.apiContextOverride?.[0]?.content,
      state.compactDraft?.content,
      state.compactedBaseline?.summaryContent,
    ]) {
      if (typeof item === 'string' && item.trim()) {
        return item;
      }
    }
    return '';
  };

  const refreshPreview = useCallback(async (): Promise<void> => {
    if (!orchestrator || !state?.isConfigLoaded) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const body = orchestrator.buildContextPreviewBody();
      const response = await fetch('/api/chat/context-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => ({}))) as {
        preview?: ContextPreviewPayload;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      setPreview(data.preview ?? null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '预览失败';
      setError(message);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [orchestrator, state?.isConfigLoaded]);

  useEffect(() => {
    if (!open || !orchestrator) {
      return;
    }
    const messages = orchestrator.buildContextPreviewBody().messages;
    const hasMessages = Array.isArray(messages) && messages.length > 0;
    if (!hasMessages && !sessionStore?.isAuthed()) {
      showToast('当前没有可预览的历史消息', 'info');
      onClose();
      return;
    }
    void refreshPreview();
  }, [open, orchestrator, onClose, refreshPreview, sessionStore]);

  const generateSummary = async (): Promise<void> => {
    if (!orchestrator || !state) {
      return;
    }
    if (!state.compactModel) {
      showToast('请先在设置中选择压缩模型', 'info');
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch('/api/chat/compact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orchestrator.buildCompactRequestBody()),
      });
      const data = (await response.json()) as {
        messages?: ApiMessage[];
        error?: string;
        elapsedMs?: number;
      };
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      const summaryMsg = data.messages?.[0];
      const content = typeof summaryMsg?.content === 'string' ? summaryMsg.content : '';
      if (!content) {
        throw new Error('摘要为空');
      }
      state.compactDraft = summaryMsg ?? null;
      const sec =
        typeof data.elapsedMs === 'number' ? `（${(data.elapsedMs / 1000).toFixed(1)}s）` : '';
      showToast(`摘要已生成${sec}，请确认后点击「应用摘要」`, 'info');
      void refreshPreview();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '生成失败';
      showToast(`生成失败: ${message}`, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const applySummary = async (): Promise<void> => {
    if (!orchestrator || !state?.compactDraft) {
      showToast('请先生成摘要', 'info');
      return;
    }
    orchestrator.applyCompactOverride(state.compactDraft);
    internals.setContextCompactedState(true);
    showToast('已应用摘要', 'info');
    await refreshPreview();
  };

  const clearOverride = async (): Promise<void> => {
    orchestrator?.resetContextCompressionState();
    internals.setContextCompactedState(false);
    showToast('已清除上下文覆盖', 'info');
    await refreshPreview();
  };

  const tokens = preview?.estimatedTokens ?? 0;
  const threshold = preview?.compactThresholdTokens ?? 0;
  const pct = threshold > 0 ? Math.min(100, (tokens / threshold) * 100) : 0;
  const compactText = resolveCompactText();

  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      modalId="context-modal"
      className="chat-modal context-modal"
      panelClassName="chat-modal-panel context-modal-panel"
      wide
    >
      <div className="context-modal-header">
        <div className="context-modal-title-wrap">
          <div className="context-modal-head-text">
            <h2 className="context-modal-title">请求上下文</h2>
            <p className="context-modal-subtitle">查看即将发送给模型的消息与 token 占用</p>
          </div>
        </div>
        <button type="button" className="context-modal-close" aria-label="关闭" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="context-modal-body">
        {error ? (
          <div className="context-status context-status-danger" role="alert">
            预览加载失败：{error}
          </div>
        ) : null}
        {preview && !error ? (
          <>
            {(preview.pendingAutoCompact || preview.wouldAutoCompact) && (
              <div
                className={`context-status ${preview.pendingAutoCompact ? 'context-status-danger' : 'context-status-warn'}`}
              >
                {preview.pendingAutoCompact
                  ? '上下文较长，发送时将自动摘要。建议先生成并应用摘要，或在设置中关闭自动压缩。'
                  : '上下文较长，建议生成摘要并应用。'}
              </div>
            )}
            <div className="context-dashboard">
              <div className="context-dashboard-top">
                <div className="context-token-main">
                  <span className="context-token-value">{tokens.toLocaleString()}</span>
                  <span className="context-token-limit">/ {threshold.toLocaleString()} tokens</span>
                  <span className="context-token-pct">{pct.toFixed(1)}%</span>
                </div>
                {isContextCompacted ? (
                  <span className="context-state-chip context-state-chip--ok">已压缩</span>
                ) : null}
              </div>
              <div className="context-token-bar" aria-hidden="true">
                <div
                  className={`context-token-bar-fill${pct >= 80 ? ' context-token-bar-fill--warn' : ''}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </>
        ) : null}
        <div className="context-scroll-stack">
          <section className="context-messages-panel">
            <div className="context-messages-head">
              <h3 className="context-section-label">消息载荷</h3>
              {preview?.messageCount ? (
                <span className="context-section-count">{preview.messageCount} 条</span>
              ) : null}
            </div>
            <div className="context-messages-list">
              {loading ? (
                <EmptyState message="正在加载…" variant="inline" />
              ) : preview?.messages?.length ? (
                preview.messages.map((message, index) => (
                  <details
                    key={`${message.role}-${index}`}
                    className={`context-msg context-msg--${message.role ?? 'system'}`}
                    open={preview.messages?.length === 1}
                  >
                    <summary className="context-msg-summary">
                      <span className="context-msg-seq">#{message.index ?? index + 1}</span>
                      <span className="context-msg-role">{message.role ?? 'unknown'}</span>
                      <span className="context-msg-meta">
                        {message.charLength ? `${message.charLength} 字 · ` : ''}
                        约 {message.estimatedTokens ?? 0} tokens
                      </span>
                    </summary>
                    <pre className="context-msg-raw">{message.preview ?? ''}</pre>
                  </details>
                ))
              ) : (
                <EmptyState message="暂无消息" variant="inline" />
              )}
            </div>
          </section>
          {compactText ? (
            <section className="context-compact-section">
              <div className="context-compact-head">
                <h3 className="context-section-label">摘要与压缩</h3>
                {isContextCompacted ? (
                  <span className="context-compact-badge context-compact-badge--active">
                    已压缩
                  </span>
                ) : hasDraft ? (
                  <span className="context-compact-badge">草稿待应用</span>
                ) : null}
              </div>
              <div className="context-compact-draft-wrap">
                <div className="context-draft-label">
                  {isContextCompacted ? '摘要（已应用）' : hasDraft ? '摘要预览' : '摘要（当前基线）'}
                </div>
                <div className="context-compact-draft markdown-content">
                  <ChatMarkdown content={compactText} />
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>
      <div className="context-modal-footer">
        <button
          type="button"
          className="context-footer-btn context-footer-btn--ghost"
          disabled={!canClear || generating}
          onClick={() => void clearOverride()}
        >
          恢复完整历史
        </button>
        <div className="context-modal-footer-primary">
          <button
            type="button"
            className="context-footer-btn context-footer-btn--secondary"
            disabled={isContextCompacted || generating}
            onClick={() => void generateSummary()}
          >
            {generating ? (
              <>
                <Spinner size="sm" />
                生成中…
              </>
            ) : (
              '生成摘要'
            )}
          </button>
          <button
            type="button"
            className="context-footer-btn context-footer-btn--primary"
            disabled={isContextCompacted || !hasDraft || generating}
            onClick={() => void applySummary()}
          >
            应用摘要
          </button>
        </div>
      </div>
    </OverlayModal>
  );
}
