'use client';

import { useState } from 'react';

import { ChatMarkdown } from './chat-markdown';
import { IconChevron } from './chat-icons';

interface ReasoningBlockProps {
  reasoning: string;
}

/** 推理折叠块 — 对齐 renderers reasoning + chat-shell-ui attachReasoningToggleEvent */
export function ReasoningBlock({ reasoning }: ReasoningBlockProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`reasoning-block ${expanded ? 'reasoning-block--expanded' : 'reasoning-block--collapsed'}`}>
      <button
        type="button"
        className="reasoning-block__header"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <IconChevron className="reasoning-block__toggle" />
        <span>{expanded ? '收起 AI 思考过程' : '查看 AI 思考过程'}</span>
      </button>
      {expanded ? (
        <div className="reasoning-block__content">
          <ChatMarkdown content={reasoning} />
        </div>
      ) : null}
    </div>
  );
}
