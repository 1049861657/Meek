'use client';

import { useCallback, useEffect, useState } from 'react';

import { ChatMarkdown } from '@/components/chat/chat-markdown';
import { EmptyState } from '@/components/ui/empty-state';
import { OverlayModal } from '@/components/ui/overlay-modal';
import { confirmModal } from '@/components/ui/confirm-dialog';
import { showToast } from '@/components/ui/toast';
import { CHAT_SESSION_ID_PREFIX } from '@/lib/chat/storage-contract';
import { AUTHED_SESSIONS_GATE_MESSAGE } from '@/lib/chat/authed-sessions-gate';
import { formatMessageTime } from '@/lib/chat/time';
import { historyEntryToRecord } from '@/lib/chat/message-view-model';
import type { HistoryEntry } from '@/lib/chat/storage-contract';
import type { SessionListItem } from '@/lib/chat/session-data';

import { formatSessionDate, type ChatModalProps } from './modal-types';

export function HistoryModal({ open, onClose, internals }: ChatModalProps): React.ReactElement {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [detailMessages, setDetailMessages] = useState<HistoryEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMeta, setDetailMeta] = useState('请从左侧选择会话');

  const sessionStore = internals.sessionStoreRef.current;
  const orchestrator = internals.orchestratorRef.current;
  const isAuthed = sessionStore?.isAuthed() ?? false;
  const isAuthedSessionsGated = sessionStore?.isAuthedSessionsGated() ?? false;
  const provider = orchestrator?.state.vendor ?? '';

  const loadSessions = useCallback(async (): Promise<void> => {
    if (!sessionStore) {
      return;
    }
    if (isAuthedSessionsGated) {
      setSessions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setSelectedId(null);
    setCheckedIds(new Set());
    setDetailMessages([]);
    setDetailMeta('请从左侧选择会话');
    try {
      const list = await sessionStore.listSessions(provider || null);
      const filtered = isAuthed
        ? list
        : list.filter(
            (session) =>
              session.id?.startsWith(CHAT_SESSION_ID_PREFIX) &&
              session.displayId &&
              session.displayId !== 'NaN'
          );
      setSessions(filtered);
      if (filtered.length > 0) {
        const first = filtered[0];
        if (first) {
          setSelectedId(first.id);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载失败';
      showToast(`加载会话失败: ${message}`, 'error');
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthed, isAuthedSessionsGated, provider, sessionStore]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadSessions();
  }, [loadSessions, open]);

  useEffect(() => {
    if (!open || !selectedId || !sessionStore) {
      return;
    }
    setDetailLoading(true);
    void sessionStore
      .getSessionMessages(selectedId)
      .then((messages) => {
        const visible = messages.filter(
          (message) => message.role === 'user' || message.role === 'assistant'
        );
        setDetailMessages(messages);
        setDetailMeta(
          visible.length > 0 ? `共 ${visible.length} 条消息` : '暂无消息'
        );
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : '加载失败';
        setDetailMeta('加载失败');
        showToast(message, 'error');
      })
      .finally(() => setDetailLoading(false));
  }, [open, selectedId, sessionStore]);

  const visibleSessions = sessions.filter((session) => {
    if (!search.trim()) {
      return true;
    }
    const term = search.toLowerCase();
    const label = isAuthed
      ? session.title || '无标题会话'
      : `会话 ${session.displayId}`;
    return label.toLowerCase().includes(term) || session.displayId.toLowerCase().includes(term);
  });

  const toggleCheck = (sessionId: string): void => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }
      return next;
    });
  };

  const selectAll = (): void => {
    setCheckedIds(new Set(visibleSessions.map((session) => session.id)));
  };

  const deselectAll = (): void => {
    setCheckedIds(new Set());
  };

  const batchDelete = async (): Promise<void> => {
    if (!sessionStore || checkedIds.size === 0) {
      showToast('请先选择要删除的会话', 'info');
      return;
    }
    const ok = await confirmModal({
      title: '批量删除确认',
      message: `确定要删除选中的 ${checkedIds.size} 个会话吗？此操作无法撤销。`,
      confirmLabel: '删除',
      cancelLabel: '取消',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    try {
      await Promise.all([...checkedIds].map((id) => sessionStore.deleteSession(id)));
      showToast(`已删除 ${checkedIds.size} 个会话`, 'info');
      await sessionStore.loadLatest();
      internals.syncSessionDisplay(sessionStore.displayId(orchestrator?.state.sessionId ?? ''));
      await loadSessions();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '删除失败';
      showToast(`批量删除失败: ${message}`, 'error');
    }
  };

  const loadSession = async (): Promise<void> => {
    if (!sessionStore || !selectedId) {
      return;
    }
    try {
      await sessionStore.loadSession(selectedId);
      onClose();
      showToast('已加载会话', 'info');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载失败';
      showToast(`加载会话失败: ${message}`, 'error');
    }
  };

  const deleteSession = async (): Promise<void> => {
    if (!sessionStore || !selectedId) {
      return;
    }
    const ok = await confirmModal({
      title: '删除确认',
      message: '确定要删除此会话吗？此操作无法撤销。',
      confirmLabel: '删除',
      cancelLabel: '取消',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    try {
      await sessionStore.deleteSession(selectedId);
      showToast('已删除会话', 'info');
      await sessionStore.loadLatest();
      internals.syncSessionDisplay(sessionStore.displayId(orchestrator?.state.sessionId ?? ''));
      await loadSessions();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '删除失败';
      showToast(`删除失败: ${message}`, 'error');
    }
  };

  const selectedDisplayId = selectedId
    ? sessionStore?.displayId(selectedId) ?? selectedId
    : '';

  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      modalId="history-modal"
      className="chat-modal history-modal"
      panelClassName="chat-modal-panel history-modal-panel"
      wide
    >
      <div className="history-modal-header">
        <div className="history-modal-title-wrap">
          <div className="history-modal-head-text">
            <h2 className="history-modal-title">聊天历史</h2>
            <p className="history-modal-subtitle">查看和管理您的会话记录</p>
          </div>
        </div>
        <button
          type="button"
          className="history-modal-close"
          aria-label="关闭"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="history-modal-body">
        {isAuthedSessionsGated ? (
          <div className="history-gate-banner" role="alert">
            {AUTHED_SESSIONS_GATE_MESSAGE}
          </div>
        ) : null}
        <aside className="history-sidebar">
          <div className="history-sidebar-head">
            <p className="history-sidebar-label">
              {provider && !isAuthed ? `${provider} · 会话列表` : '会话列表'}
            </p>
            <div className="history-sidebar-tools">
              <button type="button" className="history-link-btn" onClick={selectAll}>
                全选
              </button>
              {checkedIds.size > 0 ? (
                <button type="button" className="history-link-btn" onClick={deselectAll}>
                  取消
                </button>
              ) : null}
              <button
                type="button"
                className="history-link-btn history-link-btn--danger"
                disabled={checkedIds.size === 0}
                onClick={() => void batchDelete()}
              >
                {checkedIds.size > 0 ? `删除 · ${checkedIds.size}` : '删除'}
              </button>
            </div>
          </div>
          <div className="history-search-wrap">
            <input
              type="search"
              className="history-search-input"
              placeholder="搜索会话…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="history-sessions">
            {loading ? (
              <EmptyState message="正在加载…" variant="inline" />
            ) : visibleSessions.length === 0 ? (
              <EmptyState message="暂无聊天会话" variant="inline" />
            ) : (
              visibleSessions.map((session) => {
                const name = isAuthed
                  ? session.title || '无标题会话'
                  : `会话 ${session.displayId}`;
                return (
                  <div
                    key={session.id}
                    className={`history-session-item${selectedId === session.id ? ' active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(session.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedId(session.id);
                      }
                    }}
                  >
                    <label
                      className="history-session-check-wrap"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="history-session-check"
                        checked={checkedIds.has(session.id)}
                        onChange={() => toggleCheck(session.id)}
                      />
                    </label>
                    <span className="history-session-body">
                      <span className="history-session-name">{name}</span>
                      <span className="history-session-date">
                        {formatSessionDate(session.lastActive)}
                      </span>
                    </span>
                    {session.messageCount > 0 ? (
                      <span className="history-session-badge">{session.messageCount} 条</span>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </aside>
        <section className="history-detail">
          <div className="history-detail-head">
            <div className="history-detail-head-text">
              <h3 className="history-detail-title">
                {selectedId ? `会话 ${selectedDisplayId}` : '会话详情'}
              </h3>
              <p className="history-detail-meta">{detailMeta}</p>
            </div>
            <div className="history-detail-actions">
              <button
                type="button"
                className="history-action-btn history-action-btn--load"
                disabled={!selectedId}
                onClick={() => void loadSession()}
              >
                加载会话
              </button>
              <button
                type="button"
                className="history-action-btn history-action-btn--delete"
                disabled={!selectedId}
                onClick={() => void deleteSession()}
              >
                删除会话
              </button>
            </div>
          </div>
          <div className="history-messages">
            {!selectedId ? (
              <EmptyState message="请从左侧选择会话" variant="dashed" />
            ) : detailLoading ? (
              <EmptyState message="正在加载…" variant="dashed" />
            ) : detailMessages.length === 0 ? (
              <EmptyState message="此会话暂无消息" variant="dashed" />
            ) : (
              detailMessages
                .filter((message) => message.role !== 'tool')
                .map((message, index) => {
                  const isUser = message.role === 'user';
                  const record = historyEntryToRecord(message);
                  const timeHtml = formatMessageTime(record?.timestamp);
                  return (
                    <article
                      key={`${message.role}-${index}`}
                      className={`history-msg-row history-msg-row--${isUser ? 'user' : 'assistant'}`}
                    >
                      <div className="history-msg-bubble">
                        {!isUser ? (
                          <span className="history-msg-avatar" aria-hidden="true">
                            AI
                          </span>
                        ) : null}
                        <div className="history-msg-card">
                          {isUser ? (
                            <div className="history-msg-plain">{message.content ?? ''}</div>
                          ) : (
                            <div className="markdown-content history-msg-markdown">
                              <ChatMarkdown content={message.content ?? ''} />
                            </div>
                          )}
                          {timeHtml ? (
                            <time className="history-msg-time">{timeHtml}</time>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })
            )}
          </div>
        </section>
      </div>
    </OverlayModal>
  );
}
