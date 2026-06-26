'use client';

import { useCallback, useEffect, useState } from 'react';

import { IconNewSession, IconQuick, IconSend, IconStop } from './chat-icons';

interface ChatComposerProps {
  disabled: boolean;
  isStreaming: boolean;
  hasError: boolean;
  composerInsertRef: React.RefObject<((text: string) => void) | null>;
  onSend: (text: string) => void;
  onStop: () => void;
  onRetry: () => void;
  onNewSession: () => void;
  onOpenQuickMessages: () => void;
}

/** 输入区：发送/停止/Enter/新建会话 — 对齐 ai.html message-input-container */
export function ChatComposer({
  disabled,
  isStreaming,
  hasError,
  composerInsertRef,
  onSend,
  onStop,
  onRetry,
  onNewSession,
  onOpenQuickMessages,
}: ChatComposerProps): React.ReactElement {
  const [text, setText] = useState('');

  useEffect(() => {
    composerInsertRef.current = (value: string): void => {
      setText(value);
    };
    return () => {
      composerInsertRef.current = null;
    };
  }, [composerInsertRef]);

  const handleSubmit = useCallback(
    (event?: React.FormEvent): void => {
      event?.preventDefault();
      const trimmed = text.trim();
      if (!trimmed || (disabled && !isStreaming)) {
        return;
      }
      onSend(trimmed);
      setText('');
    },
    [disabled, isStreaming, onSend, text]
  );

  return (
    <div className="chat-composer-area">
      <form className="chat-composer" onSubmit={handleSubmit}>
        <textarea
          className="chat-composer__input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="请输入您想询问 AI 的问题…"
          rows={3}
          disabled={disabled && !isStreaming}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
        />
        <div className="chat-composer__actions">
          <button
            type="button"
            className="chat-composer__icon-btn"
            title="新建会话"
            aria-label="新建会话"
            disabled={isStreaming}
            onClick={onNewSession}
          >
            <IconNewSession />
          </button>
          <button
            type="button"
            className="chat-composer__icon-btn"
            title="快捷消息"
            aria-label="快捷消息"
            disabled={isStreaming}
            onClick={onOpenQuickMessages}
          >
            <IconQuick />
          </button>
          {hasError ? (
            <button type="button" className="chat-btn chat-btn--ghost" onClick={onRetry}>
              重试
            </button>
          ) : null}
          {isStreaming ? (
            <button
              type="button"
              className="chat-composer__icon-btn chat-composer__icon-btn--stop"
              title="停止生成"
              aria-label="停止生成"
              onClick={onStop}
            >
              <IconStop />
            </button>
          ) : (
            <button
              type="submit"
              className="chat-composer__icon-btn chat-composer__icon-btn--send"
              title="发送"
              aria-label="发送"
              disabled={disabled || !text.trim()}
            >
              <IconSend />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
