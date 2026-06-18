import { prisma } from '@meek/db';
import type { QuickMessage, QuickMessagesPayload } from '@meek/shared';

const QUICK_MESSAGE_CATEGORIES_KEY = 'quickMessageCategories';

async function readStoredCategories(): Promise<string[]> {
  const row = await prisma.setting.findFirst({
    where: { userId: null, key: QUICK_MESSAGE_CATEGORIES_KEY },
  });
  if (!row?.value || !Array.isArray(row.value)) {
    return [];
  }
  return row.value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0
  );
}

export async function getQuickMessageCategories(messages: QuickMessage[]): Promise<string[]> {
  const stored = await readStoredCategories();
  const fromMessages = messages
    .map((msg) => msg.category)
    .filter((category): category is string => typeof category === 'string' && category.trim().length > 0);
  const merged = [...stored];
  for (const category of fromMessages) {
    if (!merged.includes(category)) {
      merged.push(category);
    }
  }
  return merged;
}

export async function getQuickMessagesConfig(): Promise<QuickMessage[]> {
  const messages = await prisma.quickMessage.findMany({ orderBy: { sortId: 'asc' } });
  return messages.map((msg) => ({
    id: msg.id,
    sortId: msg.sortId,
    content: msg.content,
    result: msg.result,
    category: msg.category,
  }));
}

export interface QuickMessagesHttpResult {
  status: number;
  body: QuickMessagesPayload | { error: string; message?: string };
}

export async function handleGetQuickMessages(): Promise<QuickMessagesHttpResult> {
  try {
    console.info('[API] 请求快捷消息配置');
    const messages = await getQuickMessagesConfig();
    const categories = await getQuickMessageCategories(messages);
    return {
      status: 200,
      body: { messages, categories },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[API] 获取快捷消息配置失败:', message);
    return {
      status: 500,
      body: {
        error: '获取快捷消息配置失败',
        message,
      },
    };
  }
}
