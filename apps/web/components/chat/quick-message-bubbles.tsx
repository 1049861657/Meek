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

    let cancelled = false;
    void loadLocalQuickMessages()
      .then(({ messages }) => {
        if (cancelled || messages.length === 0) {
          return;
        }
        const picked = pickRandomMessages(messages, BUBBLE_COUNT);
        setLabels(picked.map((item) => item.content));
      })
      .catch((error: unknown) => {
        console.error('加载随机快捷消息失败:', error);
      });

    return () => {
      cancelled = true;
    };
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
        <button
          key={`${mode}-${index}-${label}`}
          type="button"
          className={bubbleClass}
          onClick={() => onSelect(label)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
