'use client';

import { useCallback, useEffect, useState } from 'react';

import { OverlayModal } from '@/components/ui/overlay-modal';
import { confirmModal } from '@/components/ui/confirm-dialog';
import { inputDialog } from '@/components/ui/input-dialog';
import { showToast } from '@/components/ui/toast';
import {
  loadLocalQuickMessages,
  persistLocalQuickMessages,
  type QuickMessageItem,
} from '@/lib/chat/quick-messages-storage';
import type { ChatModalId } from '@/hooks/use-chat-stream';

import type { ChatModalProps } from './modal-types';

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
  const [messages, setMessages] = useState<QuickMessageItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [currentCategory, setCurrentCategory] = useState('');
  const [loading, setLoading] = useState(false);
  const [ctxCategory, setCtxCategory] = useState('');
  const [ctxOpen, setCtxOpen] = useState(false);

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const data = await loadLocalQuickMessages();
      setMessages(data.messages);
      setCategories(data.categories);
      setCurrentCategory((prev) =>
        data.categories.includes(prev) ? prev : (data.categories[0] ?? '')
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '加载失败';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadData();
    }
  }, [loadData, open]);

  const commit = (nextMessages: QuickMessageItem[], nextCategories: string[]): void => {
    setMessages(nextMessages);
    setCategories(nextCategories);
    persistLocalQuickMessages(nextMessages, nextCategories);
  };

  const categoryMessages = messages.filter((msg) => msg.category === currentCategory);

  const fillComposer = (content: string): void => {
    internals.composerInsertRef.current?.(content);
    onClose();
    showToast('已填入输入框', 'info');
  };

  const openAdd = (): void => {
    if (!currentCategory) {
      showToast('请先创建分类', 'info');
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

  const deleteMessage = async (message: QuickMessageItem): Promise<void> => {
    const ok = await confirmModal({
      title: '删除确认',
      message: '确定删除这条快捷消息吗？',
      confirmLabel: '删除',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    const next = messages.filter((item) => item.id !== message.id);
    commit(next, categories);
  };

  const addCategory = async (): Promise<void> => {
    const name = await inputDialog({
      title: '新建分类',
      label: '分类名称',
      placeholder: '分类名称，最多 20 字',
    });
    if (!name?.trim()) {
      return;
    }
    const trimmed = name.trim();
    if (categories.includes(trimmed)) {
      showToast('分类已存在', 'info');
      return;
    }
    const nextCategories = [...categories, trimmed];
    commit(messages, nextCategories);
    setCurrentCategory(trimmed);
  };

  const renameCategory = async (name: string): Promise<void> => {
    const nextName = await inputDialog({
      title: '重命名分类',
      label: '新名称',
      defaultValue: name,
    });
    if (!nextName?.trim() || nextName.trim() === name) {
      return;
    }
    const trimmed = nextName.trim();
    if (categories.includes(trimmed)) {
      showToast('分类名已存在', 'info');
      return;
    }
    const nextCategories = categories.map((cat) => (cat === name ? trimmed : cat));
    const nextMessages = messages.map((msg) =>
      msg.category === name ? { ...msg, category: trimmed } : msg
    );
    commit(nextMessages, nextCategories);
    if (currentCategory === name) {
      setCurrentCategory(trimmed);
    }
    setCtxOpen(false);
  };

  const deleteCategory = async (name: string): Promise<void> => {
    const ok = await confirmModal({
      title: '删除分类',
      message: `确定删除分类「${name}」及其所有消息吗？`,
      confirmLabel: '删除',
      variant: 'danger',
    });
    if (!ok) {
      return;
    }
    const nextCategories = categories.filter((cat) => cat !== name);
    const nextMessages = messages.filter((msg) => msg.category !== name);
    commit(nextMessages, nextCategories);
    setCurrentCategory(nextCategories[0] ?? '');
    setCtxOpen(false);
  };

  return (
    <OverlayModal
      open={open}
      onClose={onClose}
      modalId="quick-messages-modal"
      className="chat-modal qm-modal"
      panelClassName="qm-modal-panel"
      wide
    >
      <header className="qm-modal-header">
        <div className="qm-header-left">
          <div>
            <h2 className="qm-modal-title">快捷消息</h2>
            <p className="qm-modal-subtitle">按分类管理测试用例 · 点击行填入输入框</p>
          </div>
        </div>
        <div className="qm-header-actions">
          <button type="button" className="qm-btn-add" onClick={openAdd}>
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
              onClick={() => void addCategory()}
            >
              +
            </button>
          </div>
          <div className="qm-cat-list" role="listbox" aria-label="消息分类">
            {categories.map((name) => (
              <div
                key={name}
                className={`qm-cat-item${name === currentCategory ? ' active' : ''}`}
                role="option"
                tabIndex={0}
                aria-selected={name === currentCategory}
                onClick={() => setCurrentCategory(name)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setCtxCategory(name);
                  setCtxOpen(true);
                }}
              >
                <span className="qm-cat-item-name">{name}</span>
                <span className="qm-cat-item-count">
                  {messages.filter((msg) => msg.category === name).length}
                </span>
              </div>
            ))}
          </div>
        </aside>
        <section className="qm-msg-main">
          <div className="qm-msg-stats">
            <span className="qm-msg-stats-title">{currentCategory || '—'}</span>
          </div>
          <div className="qm-table-wrap">
            {loading ? (
              <p>加载中…</p>
            ) : categoryMessages.length === 0 ? (
              <div className="qm-empty-state">
                <p>
                  「{currentCategory}」还没有消息
                  <br />
                  添加第一条测试用例吧
                </p>
                <button type="button" className="qm-btn-add qm-btn-add--sm" onClick={openAdd}>
                  添加消息
                </button>
              </div>
            ) : (
              <table className="qm-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>内容</th>
                    <th>预期</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryMessages.map((message) => (
                    <tr key={message.id} onClick={() => fillComposer(message.content)}>
                      <td>{message.sortId}</td>
                      <td>{message.content}</td>
                      <td>{message.result}</td>
                      <td>
                        <button
                          type="button"
                          className="qm-icon-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            openEdit(message);
                          }}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="qm-icon-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteMessage(message);
                          }}
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
      <footer className="qm-modal-footer">
        <span>点击行填入输入框 · 侧栏右键可重命名或删除分类</span>
        <span>更改自动保存</span>
      </footer>
      {ctxOpen ? (
        <div className="qm-ctx-menu">
          <button type="button" className="qm-ctx-btn" onClick={() => void renameCategory(ctxCategory)}>
            重命名
          </button>
          <button
            type="button"
            className="qm-ctx-btn danger"
            onClick={() => void deleteCategory(ctxCategory)}
          >
            删除分类
          </button>
          <button type="button" className="qm-ctx-btn" onClick={() => setCtxOpen(false)}>
            取消
          </button>
        </div>
      ) : null}
    </OverlayModal>
  );
}
