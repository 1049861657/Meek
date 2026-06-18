'use client';

import { useChatStream } from '@/hooks/use-chat-stream';

import { ChatComposer } from './chat-composer';
import { MessageList } from './message-list';

export function ChatPanel(): React.ReactElement {
  const {
    messages,
    status,
    error,
    configReady,
    sendMessage,
    stop,
    resolvePermission,
  } = useChatStream();

  const isStreaming = status === 'streaming' || status === 'loading';
  const disabled = !configReady || (status === 'loading' && !isStreaming);

  return (
    <div className="chat-panel">
      <header className="chat-panel__header">
        <h1>AI 聊天</h1>
        {!configReady ? <span className="chat-panel__badge">加载配置…</span> : null}
      </header>
      {error ? <div className="chat-panel__error" role="alert">{error}</div> : null}
      <MessageList messages={messages} onResolvePermission={resolvePermission} />
      <ChatComposer
        disabled={disabled}
        isStreaming={isStreaming}
        onSend={(text) => {
          void sendMessage(text);
        }}
        onStop={stop}
      />
    </div>
  );
}
