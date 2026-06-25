/**
 * Chat 页客户端存储契约 — 对齐 MCP-Client frontend/src/chat/storage-contract.js
 *
 * 与 session-data、设置模态读写逻辑一致；后端不读取这些键。
 */

/** IndexedDB 库名（勿改，否则旧会话不可读） */
export const CHAT_DB_NAME = 'AIChatDatabase';

/** IndexedDB 版本（与 ai-data.js onupgradeneeded 一致） */
export const CHAT_DB_VERSION = 1;

/** messages 对象仓库名 */
export const CHAT_MESSAGES_STORE = 'messages';

/** messages 表索引（createIndex 名称） */
export const CHAT_DB_INDEX_SESSION = 'sessionId';
export const CHAT_DB_INDEX_TIMESTAMP = 'timestamp';
export const CHAT_DB_INDEX_PROVIDER = 'provider';

/**
 * 新会话 ID 前缀，完整格式 `session_{yyyyMMdd-HHmmss}-{random}`。
 *
 * guest：本地 `session_*`（IndexedDB 主键域），可重生成；
 * authed：服务端 `ChatSession.id`（Prisma cuid，无前缀），由 session-store 管理。
 */
export const CHAT_SESSION_ID_PREFIX = 'session_';

/** localStorage：聊天页 UI 偏好 */
export const CHAT_SETTINGS_KEY = 'aiChatSettings';

/** localStorage：快捷消息本地自治 */
export const CHAT_QUICK_MESSAGES_KEY = 'aiQuickMessages';

export type PermissionMode = 'open' | 'interactive' | 'locked';

export interface ChatSettingsStorage {
  isStreamMode?: boolean;
  model?: string;
  enableAutoCompact?: boolean;
  compactModel?: string;
  temperature?: number;
  maxTokens?: number;
  enableMCPTools?: boolean;
  enablePrompts?: boolean;
  enableMessageHistory?: boolean;
  messageHistoryCount?: number;
  maxToolCallRounds?: number;
  permissionMode?: PermissionMode;
  enabledServerIds?: string[];
  enabledSystemToolNames?: string[];
  skipMemory?: boolean;
}

export interface CompactedBaselineStorage {
  summaryContent: string;
  historyStartIndex: number;
}

export interface ToolProgressStep {
  stepNumber: number;
  tools: string[];
  message: string;
  elapsed_ms: number;
  isDone: boolean;
}

export interface StoredToolCall {
  id: string;
  name: string;
  source?: 'system' | 'mcp';
  args: unknown;
  result?: unknown;
  isError?: boolean;
  executionTime?: number;
  progressSteps?: ToolProgressStep[];
  revision?: number;
  lastToolCallId?: string;
  planningItems?: Record<string, unknown>[];
}

/** 与 app.state.messageHistory / IDB 同构 */
export interface HistoryEntry {
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  turnId?: string;
  reasoning?: string;
  reasoning_content?: string;
  tool_calls?: unknown[];
  tool_call_id?: string;
  toolCalls?: StoredToolCall[];
  _toolResultsExpanded?: boolean;
}

export interface ChatIdbMessageRecord extends HistoryEntry {
  id?: number;
  sessionId: string;
  timestamp: number;
  provider: string;
}

export interface QuickMessage {
  id: string;
  content: string;
  category?: string;
}

export interface QuickMessagesStorage {
  messages: QuickMessage[];
  categories: string[];
}

/** 压缩基线 localStorage 键前缀；完整键 `aiCompactBaseline:{sessionId}` */
export function compactBaselineStorageKey(sessionId: string): string {
  return `aiCompactBaseline:${sessionId || ''}`;
}
