'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { OverlayModal } from '@/components/ui/overlay-modal';
import { confirmModal } from '@/components/ui/confirm-dialog';
import { inputDialog } from '@/components/ui/input-dialog';
import { showFloatingTooltip } from '@/components/ui/tooltip';
import {
  loadLocalQuickMessages,
  persistLocalQuickMessages,
  type QuickMessageItem,
} from '@/lib/chat/quick-messages-storage';
import type { ChatModalId } from '@/hooks/use-chat-stream';

import type { ChatModalProps } from './modal-types';

const ICON_EDIT = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const ICON_DELETE = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

export interface EditMessageDraft {
  mode: 'add' | 'edit';
  message?: QuickMessageItem;
  category: string;
  categories: string[];
  messages: QuickMessageItem[];
  onCommitted: (messages: QuickMessageItem[], categories: string[]) => void;
}

interface QuickMessagesModalProps extends ChatModalProps {
  onOpenModal: (id: ChatModalId) => void;
  onSetEditDraft: (draft: EditMessageDraft | null) => void;
}

export function QuickMessagesModal({
  open,
  onClose,
  internals,
  onOpenModal,
  onSetEditDraft,
}: QuickMessagesModalProps): React.ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<QuickMessageItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [currentCategory, setCurrentCategory] = useState('');
  const [inlineAddOpen, setInlineAddOpen] = useState(false);
  const [inlineAddValue, setInlineAddValue] = useState('');
  const [ctxCategory, setCtxCategory] = useState('');
  const [ctxOpen, setCtxOpen] = useState(false);
  const [ctxPos, setCtxPos] = useState({ left: 0, top: 0 });

  const loadData = useCallback((): void => {
    const data = loadLocalQuickMessages();
    setMessages(data.messages);
    setCategories(data.categories);
    setCurrentCategory((prev) =>
      data.categories.includes(prev) ? prev : (data.categories[0] ?? ''),
    );
  }, []);

  useEffect(() => {
    if (open) {
      loadData();
      setInlineAddOpen(false);
      setCtxOpen(false);
    }
  }, [loadData, open]);

  useEffect(() => {
    if (!ctxOpen) {
      return;
    }
    const onDocClick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }
      if (!target.closest('#qm-ctx-menu') && !target.closest('.qm-cat-menu-btn')) {
        setCtxOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [ctxOpen]);

  const commit = (nextMessages: QuickMessageItem[], nextCategories: string[]): void => {
    setMessages(nextMessages);
    setCategories(nextCategories);
    persistLocalQuickMessages(nextMessages, nextCategories);
  };

  const categoryMessages = messages.filter(
    (msg) => msg.category === currentCategory && msg.content.trim().length > 0,
  );
  const passCount = categoryMessages.filter((msg) => msg.result !== '×').length;
  const failCount = categoryMessages.length - passCount;

  const fillComposer = (content: string): void => {
    internals.composerInsertRef.current?.(content);
    onClose();
    showFloatingTooltip('已添加到输入框');
  };

  const openAdd = (): void => {
    if (categories.length === 0) {
      showFloatingTooltip('请先创建分类');
      setInlineAddOpen(true);
      window.setTimeout(() => inlineInputRef.current?.focus(), 0);
      return;
    }
    onSetEditDraft({
      mode: 'add',
      category: currentCategory,
      categories,
      messages,
      onCommitted: commit,
    });
    onOpenModal('edit-message');
  };

  const openEdit = (message: QuickMessageItem): void => {
    onSetEditDraft({
      mode: 'edit',
      message,
      category: message.category,
      categories,
      messages,
      onCommitted: commit,
    });
    onOpenModal('edit-message');
  };

  const toggleResult = (message: QuickMessageItem): void => {
    const passed = message.result !== '×';
    const next = messages.map((item) =>
      item.id === message.id ? { ...item, result: passed ? '×' : '√' } : item,
    );
    commit(next, categories);
  };

  const deleteMessage = async (message: QuickMessageItem): Promise<void> => {
    const ok = await confirmModal({
      title: '删除确认',
      message: '确定要删除这条快捷消息吗？',
      confirmLabel: '删除',
      cancelLabel: '取消',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    const next = messages
      .filter((item) => item.id !== message.id)
      .map((item, index) => ({ ...item, sortId: index + 1 }));
    commit(next, categories);
    showFloatingTooltip('删除成功');
  };

  const startAddCategory = (): void => {
    setInlineAddOpen(true);
    setInlineAddValue('');
    window.setTimeout(() => inlineInputRef.current?.focus(), 0);
  };

  const commitAddCategory = (): void => {
    const name = inlineAddValue.trim();
    setInlineAddOpen(false);
    setInlineAddValue('');
    if (!name) {
      return;
    }
    if (categories.includes(name)) {
      showFloatingTooltip('分类已存在');
      return;
    }
    const nextCategories = [...categories, name];
    commit(messages, nextCategories);
    setCurrentCategory(name);
    showFloatingTooltip(`已创建分类「${name}」`);
  };

  const openCategoryMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    name: string,
  ): void => {
    event.stopPropagation();
    const panel = panelRef.current;
    if (!panel) {
      return;
    }
    const panelRect = panel.getBoundingClientRect();
    const btnRect = event.currentTarget.getBoundingClientRect();
    setCtxCategory(name);
    setCtxPos({
      left: btnRect.right - panelRect.left + 4,
      top: btnRect.top - panelRect.top,
    });
    setCtxOpen(true);
  };

  const renameCategory = async (name: string): Promise<void> => {
    setCtxOpen(false);
    const nextName = await inputDialog({
      title: '重命名分类',
      label: '分类名称',
      defaultValue: name,
      confirmLabel: '保存',
      cancelLabel: '取消',
    });
    if (nextName === null || nextName.trim() === '' || nextName.trim() === name) {
      return;
    }
    const trimmed = nextName.trim();
    if (categories.includes(trimmed)) {
      showFloatingTooltip('名称已存在');
      return;
    }
    const nextCategories = categories.map((cat) => (cat === name ? trimmed : cat));
    const nextMessages = messages.map((msg) =>
      msg.category === name ? { ...msg, category: trimmed } : msg,
    );
    commit(nextMessages, nextCategories);
    if (currentCategory === name) {
      setCurrentCategory(trimmed);
    }
    showFloatingTooltip('分类已重命名');
  };

  const deleteCategory = async (name: string): Promise<void> => {
    setCtxOpen(false);
    const count = messages.filter((msg) => msg.category === name).length;
    const ok = await confirmModal({
      title: '删除分类',
      message: count
        ? `删除「${name}」将同时删除 ${count} 条消息，确定继续？`
        : `删除空分类「${name}」？`,
      confirmLabel: '删除',
      cancelLabel: '取消',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    const nextCategories = categories.filter((cat) => cat !== name);
    const nextMessages = messages
      .filter((msg) => msg.category !== name)
      .map((item, index) => ({ ...item, sortId: index + 1 }));
    commit(nextMessages, nextCategories);
    setCurrentCategory(nextCategories[0] ?? '');
    showFloatingTooltip('分类已删除');
  };

  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      modalId="quick-messages-modal"
      className="chat-modal qm-modal"
      panelClassName="qm-modal-panel"
      customPanel
    >
      <div ref={panelRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="qm-modal-header">
          <div className="qm-header-left">
            <span className="qm-modal-mark" aria-hidden="true">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="currentColor"
              >
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m0 14H6l-2 2V4h16z" />
              </svg>
            </span>
            <div>
              <h2 className="qm-modal-title">快捷消息</h2>
              <p className="qm-modal-subtitle">按分类管理测试用例 · 点击行填入输入框</p>
            </div>
          </div>
          <div className="qm-header-actions">
            <button type="button" className="qm-btn-add" onClick={openAdd}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden="true"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              添加消息
            </button>
            <button type="button" className="qm-modal-close" aria-label="关闭" onClick={onClose}>
              ×
            </button>
          </div>
        </header>

        <div className="qm-modal-body">
          <aside className="qm-cat-rail">
            <div className="qm-cat-rail-head">
              <span className="qm-cat-rail-label">分类</span>
              <button
                type="button"
                className="qm-cat-add-btn"
                title="新建分类"
                aria-label="新建分类"
                onClick={startAddCategory}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
            <div className="qm-cat-list" role="listbox" aria-label="消息分类">
              {categories.map((name) => {
                const count = messages.filter((msg) => msg.category === name).length;
                return (
                  <div
                    key={name}
                    className={`qm-cat-item${name === currentCategory ? ' active' : ''}`}
                    role="option"
                    tabIndex={0}
                    aria-selected={name === currentCategory}
                    onClick={() => setCurrentCategory(name)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setCurrentCategory(name);
                      }
                    }}
                  >
                    <span className="qm-cat-item-name">{name}</span>
                    <span className="qm-cat-badge">{count}</span>
                    <button
                      type="button"
                      className="qm-cat-menu-btn"
                      aria-label="分类操作"
                      onClick={(event) => openCategoryMenu(event, name)}
                    >
                      ⋯
                    </button>
                  </div>
                );
              })}
            </div>
            {inlineAddOpen ? (
              <div className="qm-cat-inline-add">
                <input
                  ref={inlineInputRef}
                  type="text"
                  value={inlineAddValue}
                  placeholder="分类名称，Enter 确认"
                  maxLength={20}
                  autoComplete="off"
                  onChange={(event) => setInlineAddValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      commitAddCategory();
                    }
                    if (event.key === 'Escape') {
                      setInlineAddOpen(false);
                      setInlineAddValue('');
                    }
                  }}
                  onBlur={commitAddCategory}
                />
              </div>
            ) : null}
          </aside>

          <section className="qm-msg-main">
            <div className="qm-msg-stats">
              <span className="qm-msg-stats-title">{currentCategory || '—'}</span>
              <div className="qm-stat-chips">
                <span className="qm-stat-chip neutral">{categoryMessages.length} 条</span>
                <span className="qm-stat-chip pass">{passCount} 通过</span>
                {failCount > 0 ? (
                  <span className="qm-stat-chip fail">{failCount} 失败</span>
                ) : null}
              </div>
            </div>

            <div
              className={`quick-messages-container qm-table-wrap${categoryMessages.length === 0 ? ' hidden' : ''}`}
            >
              <table className="qm-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>测试项目</th>
                      <th>结果</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {categoryMessages.map((message, displayIndex) => {
                      const passed = message.result !== '×';
                      return (
                        <tr key={message.id} onClick={() => fillComposer(message.content)}>
                          <td className="qm-col-id">{displayIndex + 1}</td>
                          <td className="qm-col-content" title={message.content}>
                            {message.content}
                          </td>
                          <td className="qm-col-result">
                            <button
                              type="button"
                              className={`qm-status-pill ${passed ? 'pass' : 'fail'}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleResult(message);
                              }}
                            >
                              {passed ? '✓ 通过' : '× 失败'}
                            </button>
                          </td>
                          <td className="qm-col-actions">
                            <span className="qm-row-actions">
                              <button
                                type="button"
                                className="qm-icon-btn"
                                title="编辑"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openEdit(message);
                                }}
                              >
                                {ICON_EDIT}
                              </button>
                              <button
                                type="button"
                                className="qm-icon-btn danger"
                                title="删除"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void deleteMessage(message);
                                }}
                              >
                                {ICON_DELETE}
                              </button>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
              </table>
            </div>

            {categoryMessages.length === 0 ? (
              <div className="qm-empty-state">
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  opacity="0.3"
                  aria-hidden="true"
                >
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m0 14H6l-2 2V4h16z" />
                </svg>
                <p>
                  「<strong>{currentCategory || '—'}</strong>」还没有消息
                  <br />
                  添加第一条测试用例吧
                </p>
                <button type="button" className="qm-btn-add qm-btn-add--sm" onClick={openAdd}>
                  添加消息
                </button>
              </div>
            ) : null}
          </section>
        </div>

        <footer className="qm-modal-footer">
          <span>点击行填入输入框 · 侧栏 ⋯ 可重命名或删除分类</span>
          <span>更改自动保存</span>
        </footer>

        <div
          id="qm-ctx-menu"
          className={`qm-ctx-menu${ctxOpen ? '' : ' hidden'}`}
          style={{ left: ctxPos.left, top: ctxPos.top }}
        >
          <button
            type="button"
            className="qm-ctx-btn"
            onClick={() => void renameCategory(ctxCategory)}
          >
            重命名
          </button>
          <button
            type="button"
            className="qm-ctx-btn danger"
            onClick={() => void deleteCategory(ctxCategory)}
          >
            删除分类
          </button>
        </div>
      </div>
    </OverlayModal>
  );
}
