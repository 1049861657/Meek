'use client';

import { useCallback, useEffect, useRef } from 'react';

import type { QuickBubbleMode } from '@/lib/chat/quick-messages-storage';

interface UseChatAutoScrollOptions {
  /** 消息条数变化时滚动 */
  messageCount: number;
  /** 流式输出时跟随滚动 */
  isStreaming: boolean;
  /** 快捷气泡显隐 */
  quickBubbleMode: QuickBubbleMode | null;
}

/**
 * 消息列表滚底 — 对齐 chat-shell-ui scrollToBottom
 */
export function useChatAutoScroll(
  containerRef: React.RefObject<HTMLDivElement | null>,
  options: UseChatAutoScrollOptions
): { scrollToBottom: () => void } {
  const { messageCount, isStreaming, quickBubbleMode } = options;
  const shouldStickRef = useRef(true);

  const scrollToBottom = useCallback((): void => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }

    const onScroll = (): void => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldStickRef.current = distance < 80;
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
    };
  }, [containerRef]);

  useEffect(() => {
    if (!shouldStickRef.current) {
      return;
    }
    scrollToBottom();
  }, [messageCount, quickBubbleMode, scrollToBottom]);

  useEffect(() => {
    if (!isStreaming || !shouldStickRef.current) {
      return;
    }

    const el = containerRef.current;
    if (!el) {
      return;
    }

    const observer = new MutationObserver(() => {
      if (shouldStickRef.current) {
        scrollToBottom();
      }
    });

    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
    };
  }, [containerRef, isStreaming, scrollToBottom]);

  return { scrollToBottom };
}
