import { fetchJson } from '@/lib/api/fetch-json';

import { CHAT_QUICK_MESSAGES_KEY, type QuickMessagesStorage } from './storage-contract';

export interface QuickMessageItem {
  id: string;
  sortId: number;
  content: string;
  result: string;
  category: string;
}

export interface QuickMessagesData {
  messages: QuickMessageItem[];
  categories: string[];
}

export type QuickBubbleMode = 'random' | 'appended';

function parseQuickMessagesResponse(data: unknown): QuickMessagesData {
  if (!data || typeof data !== 'object') {
    throw new Error('响应格式无效');
  }
  const payload = data as { messages?: unknown; categories?: unknown };
  if (!Array.isArray(payload.messages)) {
    throw new Error('响应缺少 messages');
  }
  if (!Array.isArray(payload.categories)) {
    throw new Error('响应缺少 categories');
  }
  return {
    messages: payload.messages as QuickMessageItem[],
    categories: payload.categories.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    ),
  };
}

export function persistLocalQuickMessages(
  messages: QuickMessageItem[],
  categories: string[]
): void {
  const payload: QuickMessagesStorage = { messages, categories };
  localStorage.setItem(CHAT_QUICK_MESSAGES_KEY, JSON.stringify(payload));
}

export async function loadLocalQuickMessages(): Promise<QuickMessagesData> {
  try {
    const raw = localStorage.getItem(CHAT_QUICK_MESSAGES_KEY);
    if (raw) {
      return parseQuickMessagesResponse(JSON.parse(raw));
    }
  } catch {
    /* 本地损坏则回落服务端种子 */
  }

  const seed = parseQuickMessagesResponse(await fetchJson('/api/config/quick-messages'));
  persistLocalQuickMessages(seed.messages, seed.categories);
  return seed;
}
