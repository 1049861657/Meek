'use client';

import { useEffect, useState } from 'react';

import { OverlayModal } from '@/components/ui/overlay-modal';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { showToast } from '@/components/ui/toast';
import type { QuickMessageItem } from '@/lib/chat/quick-messages-storage';

import type { EditMessageDraft } from './quick-messages-modal';
import type { ChatModalProps } from './modal-types';

interface EditMessageModalProps extends ChatModalProps {
  draft: EditMessageDraft | null;
  onSaved: () => void;
}

export function EditMessageModal({
  open,
  onClose,
  draft,
  onSaved,
}: EditMessageModalProps): React.ReactElement {
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [result, setResult] = useState('√');
  const [batchMode, setBatchMode] = useState(false);

  useEffect(() => {
    if (!open || !draft) {
      return;
    }
    setContent(draft.mode === 'edit' ? (draft.message?.content ?? '') : '');
    setCategory(draft.mode === 'edit' ? draft.message?.category ?? draft.category : draft.category);
    setResult(draft.mode === 'edit' ? (draft.message?.result ?? '√') : '√');
    setBatchMode(false);
  }, [draft, open]);

  const batchLineCount = batchMode
    ? content.split(/\r?\n/).filter((line) => line.trim()).length
    : 0;

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!draft) {
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      showToast('请输入测试内容', 'info');
      return;
    }

    let nextMessages = [...draft.messages];

    if (batchMode && draft.mode === 'add') {
      const lines = trimmed.split(/\r?\n/).filter((line) => line.trim());
      const baseSort =
        Math.max(0, ...nextMessages.filter((m) => m.category === category).map((m) => m.sortId)) +
        1;
      lines.forEach((line, index) => {
        nextMessages.push({
          id: crypto.randomUUID(),
          sortId: baseSort + index,
          content: line.trim(),
          result,
          category,
        });
      });
    } else if (draft.mode === 'edit' && draft.message) {
      nextMessages = nextMessages.map((item) =>
        item.id === draft.message?.id
          ? { ...item, content: trimmed, result, category }
          : item
      );
    } else {
      const sortId =
        Math.max(0, ...nextMessages.filter((m) => m.category === category).map((m) => m.sortId)) + 1;
      const item: QuickMessageItem = {
        id: crypto.randomUUID(),
        sortId,
        content: trimmed,
        result,
        category,
      };
      nextMessages.push(item);
    }

    draft.onCommitted(nextMessages, draft.categories);
    onSaved();
    showToast('已保存', 'info');
  };

  return (
    <OverlayModal
      open={open && draft !== null}
      onClose={onClose}
      modalId="edit-message-modal"
      className="chat-modal qm-edit-modal"
      panelClassName="qm-edit-panel"
    >
      <header className="qm-edit-header">
        <div className="qm-edit-header-text">
          <h2 className="qm-edit-title">
            {draft?.mode === 'edit' ? '编辑快捷消息' : '添加快捷消息'}
          </h2>
          <p className="qm-edit-sub">将添加到「{category}」分类</p>
        </div>
        <button type="button" className="qm-modal-close" aria-label="关闭" onClick={onClose}>
          ×
        </button>
      </header>
      <form className="qm-edit-body" onSubmit={handleSubmit}>
        <div className="qm-edit-field">
          <label htmlFor="edit-message-category">所属分类</label>
          <select
            id="edit-message-category"
            className="field-select"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {(draft?.categories ?? []).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="qm-edit-field">
          <label htmlFor="edit-message-content">测试内容</label>
          <textarea
            id="edit-message-content"
            rows={4}
            required
            placeholder="输入要发送的测试问题…"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </div>
        <div className="qm-edit-field">
          <span className="qm-edit-field-label">预期结果</span>
          <SegmentedControl
            className="qm-result-seg"
            value={result}
            options={[
              { value: '√', label: '通过' },
              { value: '×', label: '失败' },
            ]}
            onChange={setResult}
          />
        </div>
        {draft?.mode === 'add' ? (
          <div className="qm-batch-card">
            <label className="qm-batch-toggle">
              <input
                type="checkbox"
                checked={batchMode}
                onChange={(event) => setBatchMode(event.target.checked)}
              />
              批量添加（每行一条消息）
            </label>
            {batchMode ? (
              <p className="qm-batch-meta">将创建 {batchLineCount} 条消息</p>
            ) : null}
          </div>
        ) : null}
        <footer className="qm-edit-footer">
          <button type="button" className="qm-btn-ghost" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="qm-btn-primary">
            保存
          </button>
        </footer>
      </form>
    </OverlayModal>
  );
}
