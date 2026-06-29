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

const EMPTY_QUICK_MESSAGES: QuickMessagesData = {
  messages: [],
  categories: [],
};

function parseLocalQuickMessages(data: unknown): QuickMessagesData {
  if (!data || typeof data !== 'object') {
    throw new Error('本地快捷消息格式无效');
  }
  const payload = data as { messages?: unknown; categories?: unknown };
  if (!Array.isArray(payload.messages)) {
    throw new Error('本地快捷消息缺少 messages');
  }
  if (!Array.isArray(payload.categories)) {
    throw new Error('本地快捷消息缺少 categories');
  }
  return {
    messages: payload.messages as QuickMessageItem[],
    categories: payload.categories.filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0,
    ),
  };
}

export function persistLocalQuickMessages(
  messages: QuickMessageItem[],
  categories: string[],
): void {
  const payload: QuickMessagesStorage = { messages, categories };
  localStorage.setItem(CHAT_QUICK_MESSAGES_KEY, JSON.stringify(payload));
}

/** 从 localStorage 读取快捷消息；无数据时返回空列表 */
export function loadLocalQuickMessages(): QuickMessagesData {
  try {
    const raw = localStorage.getItem(CHAT_QUICK_MESSAGES_KEY);
    if (raw) {
      return parseLocalQuickMessages(JSON.parse(raw));
    }
  } catch {
    /* 损坏时回落空数据 */
  }
  return EMPTY_QUICK_MESSAGES;
}
