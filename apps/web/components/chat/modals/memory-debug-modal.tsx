'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  OverlayModal,
  OverlayModalBody,
  OverlayModalHeader,
} from '@/components/ui/overlay-modal';
import { fetchJson, postApiJson } from '@/lib/api/fetch-json';
import { formatMemoryMentionedAt } from '@/lib/chat/time';

import type { ChatModalProps } from './modal-types';

const API_BASE = '/api/memory/debug';

type DebugMode = 'recall' | 'prompt' | 'reflect';

const MODES: Record<DebugMode, { apiPath: string; failLabel: string }> = {
  recall: { apiPath: '/recall', failLabel: '检索失败' },
  prompt: { apiPath: '/prompt', failLabel: '预览失败' },
  reflect: { apiPath: '/reflect', failLabel: '推理失败' },
};

interface RecallItem {
  id?: string;
  type: string;
  text: string;
  context?: string | null;
  entities?: string[];
  mentionedAt?: string | null;
}

interface ReflectReference {
  type: string;
  text: string;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    return '';
  }
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function RecallMetaChips({ item }: { item: RecallItem }): React.ReactElement | null {
  const chips: React.ReactElement[] = [];
  if (item.entities?.length) {
    chips.push(
      <span key="entities" className="md-recall-meta-chip">
        <span className="md-recall-meta-chip-label">entities</span>
        <span className="md-recall-meta-chip-value">{item.entities.join(', ')}</span>
      </span>
    );
  }
  if (item.context) {
    chips.push(
      <span key="context" className="md-recall-meta-chip">
        <span className="md-recall-meta-chip-label">context</span>
        <span className="md-recall-meta-chip-value">{item.context}</span>
      </span>
    );
  }
  if (chips.length === 0) {
    return null;
  }
  return <div className="md-recall-meta">{chips}</div>;
}

function RecallMentionedAt({ iso }: { iso: string }): React.ReactElement | null {
  const formatted = formatMemoryMentionedAt(iso);
  if (!formatted) {
    return null;
  }
  return (
    <time className="md-recall-mentioned" dateTime={iso} title={iso}>
      <svg
        className="md-recall-mentioned-icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="13"
        height="13"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2M12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8m.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
      </svg>
      <span className="md-recall-mentioned-text">{formatted}</span>
    </time>
  );
}

function RecallResults({ results }: { results: RecallItem[] }): React.ReactElement {
  if (results.length === 0) {
    return <div className="md-results-empty">未检索到相关记忆</div>;
  }
  const knownTypes = new Set(['observation', 'world', 'experience']);
  return (
    <ul className="md-recall-list">
      {results.map((item, index) => {
        const typeCls = knownTypes.has(item.type)
          ? `md-recall-type--${item.type}`
          : 'md-recall-type--unknown';
        return (
          <li key={item.id ?? `${item.type}-${index}`} className="md-recall-item">
            <div className="md-recall-top">
              <span className={`md-recall-type ${typeCls}`}>{item.type}</span>
              {item.mentionedAt ? <RecallMentionedAt iso={item.mentionedAt} /> : null}
            </div>
            <p className="md-recall-text">{item.text}</p>
            <RecallMetaChips item={item} />
          </li>
        );
      })}
    </ul>
  );
}

function ReflectResults({
  text,
  references,
}: {
  text: string;
  references: ReflectReference[];
}): React.ReactElement {
  const answer = text.trim();
  if (!answer && references.length === 0) {
    return <div className="md-results-empty">未生成回答</div>;
  }
  return (
    <div className="md-reflect-body">
      {answer ? <p className="md-reflect-answer">{answer}</p> : null}
      {references.length > 0 ? (
        <div className="md-reflect-sources">
          <p className="md-reflect-sources-title">参考记忆</p>
          {references.map((ref, index) => (
            <p key={`${ref.type}-${index}`} className="md-reflect-source-item">
              [{ref.type}] {ref.text}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PromptResults({ content }: { content: string }): React.ReactElement {
  const text = content.trim();
  if (!text) {
    return <div className="md-results-empty">本轮不会注入记忆（无相关内容）</div>;
  }
  return <pre className="md-prompt-preview">{text}</pre>;
}

function ModePanel({
  mode,
  activeMode,
  query,
  onQueryChange,
  onSubmit,
  disabled,
  state,
  errorMessage,
  metaText,
  recallResults,
  reflectText,
  reflectReferences,
  promptContent,
}: {
  mode: DebugMode;
  activeMode: DebugMode;
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  state: 'idle' | 'loading' | 'error' | 'success';
  errorMessage: string;
  metaText: string;
  recallResults: RecallItem[];
  reflectText: string;
  reflectReferences: ReflectReference[];
  promptContent: string;
}): React.ReactElement {
  const isActive = mode === activeMode;
  const placeholders: Record<DebugMode, string> = {
    recall: '输入与聊天中相同的用户消息，例如：我的技术偏好是什么？',
    reflect: '例如：根据记忆，总结该用户的偏好和习惯',
    prompt: '输入与聊天中相同的用户消息',
  };
  const submitLabels: Record<DebugMode, string> = {
    recall: '检索记忆',
    prompt: '预览注入',
    reflect: '生成回答',
  };

  function renderSuccess(): React.ReactElement {
    if (mode === 'recall') {
      return <RecallResults results={recallResults} />;
    }
    if (mode === 'prompt') {
      return <PromptResults content={promptContent} />;
    }
    return <ReflectResults text={reflectText} references={reflectReferences} />;
  }

  return (
    <section
      className={`md-mode-panel${isActive ? ' is-active' : ''}`}
      id={`memory-debug-panel-${mode}`}
      role="tabpanel"
      aria-labelledby={`memory-debug-tab-${mode}`}
      hidden={!isActive}
    >
      <div className="md-field">
        <label className="md-field-label" htmlFor={`memory-debug-${mode}-query`}>
          提问内容
        </label>
        <textarea
          id={`memory-debug-${mode}-query`}
          className="md-query-input"
          rows={4}
          placeholder={placeholders[mode]}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      <div className="md-actions">
        <button
          type="button"
          id={`memory-debug-${mode}-submit`}
          className="md-btn-primary"
          disabled={disabled || state === 'loading'}
          onClick={onSubmit}
        >
          {submitLabels[mode]}
        </button>
      </div>
      <div className="md-results-head">
        <span id={`memory-debug-${mode}-meta`} className="md-results-meta">
          {metaText}
        </span>
      </div>
      <div id={`memory-debug-${mode}-results`} className="md-results-panel">
        {state === 'loading' ? (
          <div className="md-results-loading">
            <span className="ui-spinner ui-spinner--md" aria-hidden="true" />
            正在请求…
          </div>
        ) : null}
        {state === 'error' ? (
          <div className="md-results-error">{errorMessage || '请求失败'}</div>
        ) : null}
        {state === 'idle' ? (
          <div className="md-results-empty">输入提问内容后点击按钮</div>
        ) : null}
        {state === 'success' ? renderSuccess() : null}
      </div>
    </section>
  );
}

export function MemoryDebugModal({ open, onClose }: ChatModalProps): React.ReactElement {
  const [activeMode, setActiveMode] = useState<DebugMode>('recall');
  const [enabled, setEnabled] = useState(false);
  const [bankId, setBankId] = useState<string | null>(null);
  const [unavailableMessage, setUnavailableMessage] = useState('');
  const [queries, setQueries] = useState<Record<DebugMode, string>>({
    recall: '',
    prompt: '',
    reflect: '',
  });
  const [panelState, setPanelState] = useState<
    Record<DebugMode, 'idle' | 'loading' | 'error' | 'success'>
  >({
    recall: 'idle',
    prompt: 'idle',
    reflect: 'idle',
  });
  const [panelErrors, setPanelErrors] = useState<Record<DebugMode, string>>({
    recall: '',
    prompt: '',
    reflect: '',
  });
  const [panelMeta, setPanelMeta] = useState<Record<DebugMode, string>>({
    recall: '',
    prompt: '',
    reflect: '',
  });
  const [recallResults, setRecallResults] = useState<RecallItem[]>([]);
  const [reflectText, setReflectText] = useState('');
  const [reflectReferences, setReflectReferences] = useState<ReflectReference[]>([]);
  const [promptContent, setPromptContent] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const loadMeta = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      const meta = (await fetchJson(`${API_BASE}/meta`, { signal })) as {
        enabled?: boolean;
        bankId?: string | null;
      };
      if (meta.enabled !== true) {
        setEnabled(false);
        setUnavailableMessage(
          'Hindsight 未配置，无法使用记忆调试。请在服务端配置 HINDSIGHT_API_KEY 后重试。'
        );
        return;
      }
      setEnabled(true);
      setUnavailableMessage('');
      setBankId(typeof meta.bankId === 'string' && meta.bankId ? meta.bankId : null);
    } catch (error) {
      setEnabled(false);
      setUnavailableMessage(error instanceof Error ? error.message : '无法加载调试信息');
    }
  }, []);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void loadMeta(controller.signal);
    return () => {
      controller.abort();
    };
  }, [open, loadMeta]);

  const runMode = useCallback(
    async (mode: DebugMode): Promise<void> => {
      if (!enabled) {
        return;
      }
      const cfg = MODES[mode];
      const query = queries[mode].trim();
      if (!query) {
        setPanelState((prev) => ({ ...prev, [mode]: 'error' }));
        setPanelErrors((prev) => ({ ...prev, [mode]: '请输入提问内容' }));
        setPanelMeta((prev) => ({ ...prev, [mode]: '' }));
        return;
      }

      setPanelState((prev) => ({ ...prev, [mode]: 'loading' }));
      setPanelErrors((prev) => ({ ...prev, [mode]: '' }));
      setPanelMeta((prev) => ({ ...prev, [mode]: '' }));

      try {
        const data = await postApiJson(
          `${API_BASE}${cfg.apiPath}`,
          { query },
          abortRef.current?.signal
        );
        if (mode === 'recall') {
          const results = Array.isArray(data.results) ? (data.results as RecallItem[]) : [];
          setRecallResults(results);
          const duration = formatDuration(Number(data.durationMs));
          setPanelMeta((prev) => ({
            ...prev,
            recall: duration ? `${results.length} 条 · ${duration}` : `${results.length} 条`,
          }));
        } else if (mode === 'prompt') {
          const content = typeof data.content === 'string' ? data.content : '';
          setPromptContent(content);
          const chars = Number(data.charCount) || content.length;
          const duration = formatDuration(Number(data.durationMs));
          setPanelMeta((prev) => ({
            ...prev,
            prompt: duration
              ? `约 ${chars.toLocaleString()} 字 · ${duration}`
              : `约 ${chars.toLocaleString()} 字`,
          }));
        } else {
          setReflectText(typeof data.text === 'string' ? data.text : '');
          setReflectReferences(
            Array.isArray(data.references) ? (data.references as ReflectReference[]) : []
          );
          setPanelMeta((prev) => ({
            ...prev,
            reflect: formatDuration(Number(data.durationMs)),
          }));
        }
        setPanelState((prev) => ({ ...prev, [mode]: 'success' }));
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setPanelState((prev) => ({ ...prev, [mode]: 'error' }));
        setPanelErrors((prev) => ({
          ...prev,
          [mode]: error instanceof Error ? error.message : cfg.failLabel,
        }));
      }
    },
    [enabled, queries]
  );

  const setQuery = useCallback((mode: DebugMode, value: string): void => {
    setQueries((prev) => ({ ...prev, [mode]: value }));
  }, []);

  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      modalId="memory-debug-modal"
      className="chat-modal md-modal"
      panelClassName="md-modal-panel"
      wide
    >
      <OverlayModalHeader title="记忆调试" onClose={onClose} />
      <OverlayModalBody>
        {bankId ? <span className="md-bank-pill">bank: {bankId}</span> : null}
        {unavailableMessage ? (
          <div className="md-banner md-banner--error" role="alert">
            {unavailableMessage}
          </div>
        ) : null}
        <div className="md-mode-tabs" role="tablist">
          {(['recall', 'reflect', 'prompt'] as const).map((mode) => {
            const labels: Record<DebugMode, string> = {
              recall: 'Recall 检索',
              reflect: 'Reflect 推理',
              prompt: '注入预览',
            };
            return (
              <button
                key={mode}
                type="button"
                className={`md-mode-tab${activeMode === mode ? ' is-active' : ''}`}
                data-mode={mode}
                id={`memory-debug-tab-${mode}`}
                role="tab"
                aria-selected={activeMode === mode}
                onClick={() => setActiveMode(mode)}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>
        {(['recall', 'reflect', 'prompt'] as const).map((mode) => (
          <ModePanel
            key={mode}
            mode={mode}
            activeMode={activeMode}
            query={queries[mode]}
            onQueryChange={(value) => setQuery(mode, value)}
            onSubmit={() => void runMode(mode)}
            disabled={!enabled}
            state={panelState[mode]}
            errorMessage={panelErrors[mode]}
            metaText={panelMeta[mode]}
            recallResults={recallResults}
            reflectText={reflectText}
            reflectReferences={reflectReferences}
            promptContent={promptContent}
          />
        ))}
      </OverlayModalBody>
    </OverlayModal>
  );
}
