'use client';

import { useEffect, useState } from 'react';

import { loadLocalQuickMessages, type QuickBubbleMode } from '@/lib/chat/quick-messages-storage';

export type { QuickBubbleMode };

interface QuickMessageBubblesProps {
  mode: QuickBubbleMode;
  visible: boolean;
  onSelect: (text: string) => void;
}

const BUBBLE_COUNT = 3;

function pickRandomMessages<T>(items: T[], count: number): T[] {
  const shuffled = [...items].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, items.length));
}

/** 随机/追加快捷消息气泡 — 对齐 quickmessage.js showQuickMessageBubbles */
export function QuickMessageBubbles({
  mode,
  visible,
  onSelect,
}: QuickMessageBubblesProps): React.ReactElement | null {
  const [labels, setLabels] = useState<string[]>([]);

  useEffect(() => {
    if (!visible) {
      setLabels([]);
      return;
    }

    const { messages } = loadLocalQuickMessages();
    if (messages.length === 0) {
      setLabels([]);
      return;
    }
    const picked = pickRandomMessages(messages, BUBBLE_COUNT);
    setLabels(picked.map((item) => item.content));
  }, [mode, visible]);

  if (!visible || labels.length === 0) {
    return null;
  }

  const containerClass =
    mode === 'appended' ? 'appended-quick-bubbles' : 'quick-message-bubbles';
  const bubbleClass =
    mode === 'appended' ? 'appended-quick-bubble' : 'quick-message-bubble';

  return (
    <div className={containerClass}>
      {labels.map((label, index) => (
        <div
          key={`${mode}-${index}-${label}`}
          role="button"
          tabIndex={0}
          className={bubbleClass}
          onClick={() => onSelect(label)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(label);
            }
          }}
        >
          {label}
        </div>
      ))}
    </div>
  );
}
