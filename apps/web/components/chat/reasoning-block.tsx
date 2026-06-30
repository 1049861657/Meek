'use client';

import { useEffect, useState } from 'react';

import { ChatMarkdown } from './chat-markdown';
import { IconChevron } from './chat-icons';

interface ReasoningBlockProps {
  reasoning: string;
  isStreaming?: boolean;
}

function reasoningTitle(collapsed: boolean, isStreaming: boolean): string {
  if (!collapsed) {
    return isStreaming ? 'AI 正在思考中...' : '收起 AI 思考过程';
  }
  return '查看 AI 思考过程';
}

/** 推理折叠块 — 对齐 reasoning-container + finalizeAIMessage */
export function ReasoningBlock({
  reasoning,
  isStreaming = false,
}: ReasoningBlockProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState(!isStreaming);

  useEffect(() => {
    if (!isStreaming) {
      setCollapsed(true);
    }
  }, [isStreaming]);

  return (
    <div className={`reasoning-container${collapsed ? ' collapsed' : ''}`}>
      <div
        className="reasoning-header"
        role="button"
        tabIndex={0}
        onClick={() => setCollapsed((prev) => !prev)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setCollapsed((prev) => !prev);
          }
        }}
      >
        <IconChevron className="toggle-icon" />
        <span className="title-text">{reasoningTitle(collapsed, isStreaming)}</span>
      </div>
      <div className="reasoning-content markdown-content" data-raw-content={reasoning}>
        <ChatMarkdown content={reasoning} bare />
      </div>
    </div>
  );
}
