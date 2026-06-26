'use client';

import { showToast } from '@/components/ui/toast';

import {
  IconClear,
  IconCompact,
  IconHistory,
  IconMcp,
  IconSettings,
} from './chat-icons';

export type ChatToolbarAction =
  | 'mcp'
  | 'history'
  | 'compact'
  | 'clear'
  | 'settings';

interface ChatToolbarProps {
  sessionDisplayId: string;
  mcpEnabledCount: number;
  isStreaming: boolean;
  onClearChat: () => void;
  onToolbarAction?: (action: ChatToolbarAction) => void;
}

/** 会话栏 + 工具栏 — 对齐 ai.html session-info / session-buttons */
export function ChatToolbar({
  sessionDisplayId,
  mcpEnabledCount,
  isStreaming,
  onClearChat,
  onToolbarAction,
}: ChatToolbarProps): React.ReactElement {
  const handleAction = (action: ChatToolbarAction): void => {
    if (action === 'clear') {
      onClearChat();
      return;
    }
    if (onToolbarAction) {
      onToolbarAction(action);
      return;
    }
    const labels: Record<Exclude<ChatToolbarAction, 'clear'>, string> = {
      mcp: 'MCP 服务器',
      history: '历史记录',
      compact: '上下文',
      settings: '聊天设置',
    };
    showToast(`${labels[action]} 未连接`, 'info');
  };

  return (
    <div className="chat-toolbar">
      <div className="chat-toolbar__session">
        <span className="chat-toolbar__session-label">当前会话:</span>
        <span className="chat-toolbar__session-id" title={sessionDisplayId || '新会话'}>
          {sessionDisplayId || '新会话'}
        </span>
      </div>
      <div className="chat-toolbar__actions">
        <button
          type="button"
          className="chat-toolbar__btn"
          title="MCP 服务器工具"
          aria-label="MCP 服务器工具"
          disabled={isStreaming}
          onClick={() => handleAction('mcp')}
        >
          <IconMcp />
          {mcpEnabledCount > 0 ? (
            <span className="chat-toolbar__badge">{mcpEnabledCount}</span>
          ) : null}
        </button>
        <button
          type="button"
          className="chat-toolbar__btn"
          title="历史记录"
          aria-label="历史记录"
          disabled={isStreaming}
          onClick={() => handleAction('history')}
        >
          <IconHistory />
        </button>
        <button
          type="button"
          className="chat-toolbar__btn"
          title="请求上下文"
          aria-label="请求上下文"
          disabled={isStreaming}
          onClick={() => handleAction('compact')}
        >
          <IconCompact />
        </button>
        <button
          type="button"
          className="chat-toolbar__btn"
          title="清除对话"
          aria-label="清除对话"
          disabled={isStreaming}
          onClick={() => handleAction('clear')}
        >
          <IconClear />
        </button>
        <button
          type="button"
          className="chat-toolbar__btn"
          title="设置"
          aria-label="设置"
          disabled={isStreaming}
          onClick={() => handleAction('settings')}
        >
          <IconSettings />
        </button>
      </div>
    </div>
  );
}
