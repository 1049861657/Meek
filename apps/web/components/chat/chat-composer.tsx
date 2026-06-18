'use client';

import { useCallback, useState } from 'react';

interface ChatComposerProps {
  disabled: boolean;
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}

export function ChatComposer({
  disabled,
  isStreaming,
  onSend,
  onStop,
}: ChatComposerProps): React.ReactElement {
  const [text, setText] = useState('');

  const handleSubmit = useCallback(
    (event: React.FormEvent): void => {
      event.preventDefault();
      const trimmed = text.trim();
      if (!trimmed || disabled) {
        return;
      }
      onSend(trimmed);
      setText('');
    },
    [disabled, onSend, text]
  );

  return (
    <form className="chat-composer" onSubmit={handleSubmit}>
      <textarea
        className="chat-composer__input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="输入消息…"
        rows={3}
        disabled={disabled && !isStreaming}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSubmit(event);
          }
        }}
      />
      <div className="chat-composer__actions">
        {isStreaming ? (
          <button type="button" className="chat-btn chat-btn--danger" onClick={onStop}>
            停止生成
          </button>
        ) : (
          <button type="submit" className="chat-btn chat-btn--primary" disabled={disabled || !text.trim()}>
            发送
          </button>
        )}
      </div>
    </form>
  );
}
