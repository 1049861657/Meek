'use client';

import { useEffect, useMemo, useState } from 'react';

import { DropdownSelect } from '@/components/ui/dropdown-select';
import { OverlayModal } from '@/components/ui/overlay-modal';
import { showFloatingTooltip } from '@/components/ui/tooltip';
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
  const [result, setResult] = useState('×');
  const [batchMode, setBatchMode] = useState(false);
  const [sortId, setSortId] = useState(1);

  useEffect(() => {
    if (!open || !draft) {
      return;
    }
    if (draft.mode === 'edit' && draft.message) {
      setContent(draft.message.content);
      setCategory(draft.message.category);
      setResult(draft.message.result === '×' ? '×' : '√');
      setSortId(draft.message.sortId);
    } else {
      setContent('');
      setCategory(draft.category);
      setResult('×');
      const maxSortId = Math.max(
        0,
        ...draft.messages.map((item) => Number.parseInt(String(item.sortId), 10) || 0),
      );
      setSortId(maxSortId + 1);
    }
    setBatchMode(false);
  }, [draft, open]);

  const batchLineCount = batchMode
    ? content.split(/\r?\n/).filter((line) => line.trim()).length
    : 0;

  const categoryOptions = useMemo(
    () => (draft?.categories ?? []).map((name) => ({ value: name, label: name })),
    [draft?.categories],
  );

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (!draft) {
      return;
    }
    const trimmed = content.trim();
    if (!trimmed && !batchMode) {
      showFloatingTooltip('消息内容不能为空');
      return;
    }

    let nextMessages = [...draft.messages];

    if (batchMode && draft.mode === 'add') {
      const lines = content.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length === 0) {
        showFloatingTooltip('没有有效的消息内容');
        return;
      }
      const baseSort =
        Math.max(0, ...nextMessages.map((item) => Number.parseInt(String(item.sortId), 10) || 0)) +
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
      draft.onCommitted(nextMessages, draft.categories);
      onSaved();
      showFloatingTooltip(`成功添加 ${lines.length} 条消息`);
      return;
    }

    if (!trimmed) {
      showFloatingTooltip('消息内容不能为空');
      return;
    }

    if (draft.mode === 'edit' && draft.message) {
      nextMessages = nextMessages.map((item) =>
        item.id === draft.message?.id
          ? { ...item, content: trimmed, result, category, sortId: draft.message.sortId }
          : item,
      );
      draft.onCommitted(nextMessages, draft.categories);
      onSaved();
      showFloatingTooltip('更新成功');
      return;
    }

    const item: QuickMessageItem = {
      id: crypto.randomUUID(),
      sortId,
      content: trimmed,
      result,
      category,
    };
    nextMessages.push(item);
    draft.onCommitted(nextMessages, draft.categories);
    onSaved();
    showFloatingTooltip('添加成功');
  };

  return (
    <OverlayModal
      open={open && draft !== null}
      onClose={onClose}
      modalId="edit-message-modal"
      className="chat-modal qm-edit-modal"
      panelClassName="qm-edit-panel"
      customPanel
    >
      <header className="qm-edit-header">
        <div className="qm-edit-header-text">
          <h2 className="qm-edit-title">
            {draft?.mode === 'edit' ? '编辑快捷消息' : '新增快捷消息'}
          </h2>
          <p className="qm-edit-sub">将添加到「{category || '—'}」分类</p>
        </div>
        <button type="button" className="qm-modal-close" aria-label="关闭" onClick={onClose}>
          ×
        </button>
      </header>
      <form className="qm-edit-body" onSubmit={handleSubmit}>
        <div className="qm-edit-field-row">
          <div className="qm-edit-field">
            <label htmlFor="edit-message-sortid">序号</label>
            <input id="edit-message-sortid" type="number" value={sortId} readOnly />
          </div>
          <div className="qm-edit-field">
            <label htmlFor="edit-message-category">所属分类</label>
            <DropdownSelect
              value={category}
              options={categoryOptions}
              placeholder="选择分类"
              onChange={setCategory}
            />
          </div>
        </div>
        <div className="qm-edit-field">
          <label htmlFor="edit-message-content">测试内容</label>
          <textarea
            id="edit-message-content"
            rows={batchMode ? 8 : 4}
            required={!batchMode}
            placeholder={
              batchMode ? '每行一条消息…' : '输入要发送的测试问题…'
            }
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </div>
        <div className="qm-edit-field">
          <span className="qm-edit-field-label">预期结果</span>
          <div className="ui-segmented qm-result-seg">
            <button
              type="button"
              className={`ui-seg-btn qm-result-seg-btn${result === '√' ? ' active pass' : ''}`}
              onClick={() => setResult('√')}
            >
              通过
            </button>
            <button
              type="button"
              className={`ui-seg-btn qm-result-seg-btn${result === '×' ? ' active fail' : ''}`}
              onClick={() => setResult('×')}
            >
              失败
            </button>
          </div>
        </div>
        {draft?.mode === 'add' ? (
          <div className="qm-batch-card batch-mode-group">
            <label className="qm-batch-toggle">
              <input
                type="checkbox"
                checked={batchMode}
                onChange={(event) => setBatchMode(event.target.checked)}
              />
              批量添加（每行一条消息）
            </label>
            {batchMode ? (
              <p className="qm-batch-meta">
                将创建 <strong>{batchLineCount}</strong> 条消息
              </p>
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
