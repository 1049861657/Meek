/** 记忆调试：Recall 单条结果（API 响应用） */
export interface MemoryDebugRecallItem {
  id: string;
  type: string;
  text: string;
  context?: string | null;
  entities?: string[];
  mentionedAt?: string | null;
}

/** 记忆调试：Recall 响应 */
export interface MemoryDebugRecallPayload {
  bankId: string;
  query: string;
  durationMs: number;
  results: MemoryDebugRecallItem[];
}

/** 记忆调试：Reflect 参考记忆 */
export interface MemoryDebugReflectReference {
  type: string;
  text: string;
}

/** 记忆调试：Reflect 响应 */
export interface MemoryDebugReflectPayload {
  bankId: string;
  query: string;
  durationMs: number;
  text: string;
  references: MemoryDebugReflectReference[];
}

/** 记忆调试：与聊天注入 system 一致的 memory 段正文 */
export interface MemoryDebugPromptPayload {
  bankId: string;
  query: string;
  durationMs: number;
  content: string;
  charCount: number;
  injected: boolean;
}

/** GET /api/memory/debug/meta */
export interface MemoryDebugMetaPayload {
  enabled: boolean;
  bankId: string | null;
}
