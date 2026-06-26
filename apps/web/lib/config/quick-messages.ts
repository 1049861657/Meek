import { ConfigService } from '@meek/config-plane';
import type { QuickMessage, QuickMessagesPayload } from '@meek/shared';

export async function getQuickMessageCategories(messages: QuickMessage[]): Promise<string[]> {
  return ConfigService.getQuickMessageCategories(messages);
}

export async function getQuickMessagesConfig(): Promise<QuickMessage[]> {
  return ConfigService.getQuickMessagesConfig();
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
