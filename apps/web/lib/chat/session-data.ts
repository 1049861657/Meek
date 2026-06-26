/**
 * Guest 会话数据管理 — 对齐 session-data.js
 */

import { clearCompactedBaselineFromStorage, loadCompactedBaselineFromStorage } from './compact-baseline-storage';
import {
  CHAT_DB_INDEX_PROVIDER,
  CHAT_DB_INDEX_TIMESTAMP,
  CHAT_MESSAGES_STORE,
} from './storage-contract';
import {
  filterPersistableHistoryEntries,
  isEphemeralHarnessMessage,
  mapIdbRecordToHistoryEntry,
} from './message-history-builder';
import { buildConversationReplay } from './session-conversation';
import {
  ChatSessionIdb,
  createGuestSessionId,
  type ChatIdbState,
} from './session-idb';
import type { CompactedBaselineStorage, HistoryEntry } from './storage-contract';

export interface SessionListItem {
  id: string;
  displayId: string;
  title: string;
  preview: string;
  messageCount: number;
  lastActive: string;
  timestamp: number;
  provider: string;
}

export interface ChatSessionDataDeps {
  isAuthed: () => boolean;
  getProvider: () => string;
  isConfigLoaded: () => boolean;
  onSessionChanged?: (sessionId: string) => void;
  onHistoryLoaded?: (entries: HistoryEntry[]) => void;
  onReplayReady?: (items: ReturnType<typeof buildConversationReplay>) => void;
  onCompactBaselineLoaded?: (baseline: CompactedBaselineStorage | null) => void;
}

export class ChatSessionData {
  readonly idb = new ChatSessionIdb();
  sessionId = '';
  messageHistory: HistoryEntry[] = [];
  isLoading = false;

  constructor(private readonly deps: ChatSessionDataDeps) {}

  get db(): ChatIdbState {
    return this.idb.db;
  }

  init(): void {
    this.idb.initDatabase(() => {
      if (this.deps.isAuthed()) {
        return;
      }
      void this.loadMessageHistory();
    });
  }

  whenIdbReady(): Promise<void> {
    return this.idb.whenReady();
  }

  async getAllChatSessions(provider: string | null = null): Promise<SessionListItem[]> {
    if (!this.idb.db.isReady || !this.idb.db.instance) {
      throw new Error('数据库未就绪');
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.idb.db.instance!.transaction([CHAT_MESSAGES_STORE], 'readonly');
        const store = transaction.objectStore(CHAT_MESSAGES_STORE);
        const sessionsMap: Record<
          string,
          {
            sessionId: string;
            messages: Array<{ role: string; content?: string }>;
            lastTimestamp: number;
            messageCount: number;
            provider: string;
          }
        > = {};

        let request: IDBRequest<IDBCursorWithValue | null>;
        if (provider && store.indexNames.contains(CHAT_DB_INDEX_PROVIDER)) {
          const index = store.index(CHAT_DB_INDEX_PROVIDER);
          request = index.openCursor(IDBKeyRange.only(provider));
        } else {
          request = store.openCursor();
        }

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const message = cursor.value as HistoryEntry & {
              sessionId: string;
              timestamp: number;
              provider?: string;
            };
            const sessionId = message.sessionId;
            const messageProvider = message.provider || 'unknown';

            if (provider && messageProvider !== provider) {
              cursor.continue();
              return;
            }

            if (!sessionsMap[sessionId]) {
              sessionsMap[sessionId] = {
                sessionId,
                messages: [],
                lastTimestamp: 0,
                messageCount: 0,
                provider: messageProvider,
              };
            }

            const session = sessionsMap[sessionId];
            if (message.role === 'user' || message.role === 'assistant') {
              session.messageCount++;
            }
            session.lastTimestamp = Math.max(session.lastTimestamp, message.timestamp);

            const userCount = session.messages.filter((m) => m.role === 'user').length;
            const aiCount = session.messages.filter((m) => m.role === 'assistant').length;

            if (
              (message.role === 'user' && userCount < 2) ||
              (message.role === 'assistant' && aiCount < 1)
            ) {
              session.messages.push({ role: message.role, content: message.content });
            }

            cursor.continue();
          } else {
            const sessions = Object.values(sessionsMap).sort(
              (a, b) => b.lastTimestamp - a.lastTimestamp
            );

            resolve(
              sessions.map((session) => {
                const firstUser = session.messages.find((m) => m.role === 'user');
                const firstAi = session.messages.find((m) => m.role === 'assistant');
                const lastActiveDate = new Date(session.lastTimestamp);
                const formattedDate = lastActiveDate.toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                });

                return {
                  id: session.sessionId,
                  displayId: session.sessionId.replace('session_', ''),
                  title: firstUser
                    ? (firstUser.content ?? '').substring(0, 50)
                    : '无标题会话',
                  preview: firstAi
                    ? (firstAi.content ?? '').substring(0, 100)
                    : '无预览内容',
                  messageCount: session.messageCount,
                  lastActive: formattedDate,
                  timestamp: session.lastTimestamp,
                  provider: session.provider,
                };
              })
            );
          }
        };

        request.onerror = () => {
          reject(request.error ?? new Error('获取会话列表失败'));
        };
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  async getLatestProviderSession(): Promise<string | null> {
    if (!this.idb.db.isReady || !this.idb.db.instance) {
      throw new Error('数据库未就绪');
    }

    const currentProvider = this.deps.getProvider();
    if (!currentProvider) {
      throw new Error('未选择供应商');
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.idb.db.instance!.transaction([CHAT_MESSAGES_STORE], 'readonly');
        const store = transaction.objectStore(CHAT_MESSAGES_STORE);

        let request: IDBRequest<IDBCursorWithValue | null>;
        if (store.indexNames.contains(CHAT_DB_INDEX_PROVIDER)) {
          request = store
            .index(CHAT_DB_INDEX_PROVIDER)
            .openCursor(IDBKeyRange.only(currentProvider), 'prev');
        } else {
          request = store.index(CHAT_DB_INDEX_TIMESTAMP).openCursor(null, 'prev');
        }

        let latestSession: string | null = null;
        let latestTimestamp = 0;
        const processedSessions = new Set<string>();

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const message = cursor.value as { sessionId: string; timestamp: number; provider?: string };
            const sessionId = message.sessionId;
            const messageProvider = message.provider || 'unknown';

            if (
              !store.indexNames.contains(CHAT_DB_INDEX_PROVIDER) &&
              messageProvider !== currentProvider
            ) {
              cursor.continue();
              return;
            }

            if (!processedSessions.has(sessionId) && message.timestamp > latestTimestamp) {
              latestSession = sessionId;
              latestTimestamp = message.timestamp;
              processedSessions.add(sessionId);
            }

            if (processedSessions.size >= 100) {
              resolve(latestSession);
              return;
            }

            cursor.continue();
          } else {
            resolve(latestSession);
          }
        };

        request.onerror = () => {
          reject(request.error ?? new Error('获取最新会话失败'));
        };
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  createNewSession(): string {
    const sessionId = createGuestSessionId();
    this.sessionId = sessionId;
    this.messageHistory = [];
    this.deps.onSessionChanged?.(sessionId);
    return sessionId;
  }

  async loadSession(sessionId: string): Promise<string> {
    if (!sessionId) {
      throw new Error('无效的会话ID');
    }

    this.isLoading = true;
    try {
      const messages = await this.idb.getSessionMessages(sessionId);

      if (!messages.length) {
        this.sessionId = sessionId;
        this.messageHistory = [];
        this.deps.onSessionChanged?.(sessionId);
        this.deps.onHistoryLoaded?.([]);
        this.deps.onReplayReady?.([]);
        return sessionId;
      }

      this.sessionId = sessionId;
      this.messageHistory = messages
        .filter((msg) => !isEphemeralHarnessMessage(msg))
        .map(mapIdbRecordToHistoryEntry);

      const baseline = loadCompactedBaselineFromStorage(sessionId, {
        isAuthed: this.deps.isAuthed,
      });
      this.deps.onCompactBaselineLoaded?.(baseline);
      this.deps.onSessionChanged?.(sessionId);
      this.deps.onHistoryLoaded?.(this.messageHistory);
      this.deps.onReplayReady?.(buildConversationReplay(this.messageHistory));

      return sessionId;
    } finally {
      this.isLoading = false;
    }
  }

  async loadLatestProviderSession(): Promise<string> {
    this.isLoading = true;
    try {
      const sessionId = await this.getLatestProviderSession();
      if (sessionId) {
        return this.loadSession(sessionId);
      }
      return this.createNewSession();
    } catch {
      return this.createNewSession();
    } finally {
      this.isLoading = false;
    }
  }

  async loadMessageHistory(): Promise<void> {
    if (!this.idb.db.isReady || !this.sessionId) {
      return;
    }

    try {
      const messages = await this.idb.loadChatHistory(this.sessionId, 50);
      if (messages.length > 0) {
        this.messageHistory = filterPersistableHistoryEntries(
          messages.map(mapIdbRecordToHistoryEntry)
        );
        this.deps.onHistoryLoaded?.(this.messageHistory);
      } else {
        this.messageHistory = [];
      }
    } catch (error: unknown) {
      console.error('加载消息历史失败:', error);
      this.messageHistory = [];
    }
  }

  saveMessageHistory(): void {
    if (this.messageHistory.length === 0 || !this.idb.db.isReady || !this.sessionId) {
      return;
    }

    let startIdx = 0;
    for (let i = this.messageHistory.length - 1; i >= 0; i--) {
      if (this.messageHistory[i]?.role === 'user') {
        startIdx = i;
        break;
      }
    }
    const turnMessages = this.messageHistory.slice(startIdx);
    const provider = this.deps.getProvider();

    for (const msg of turnMessages) {
      if (isEphemeralHarnessMessage(msg)) {
        continue;
      }
      void this.idb.saveChatMessage(msg, this.sessionId, provider).catch((error: unknown) => {
        console.error('保存消息失败:', error);
      });
    }
  }

  deleteSessionMessages(sessionId: string): Promise<void> {
    clearCompactedBaselineFromStorage(sessionId);
    return this.idb.deleteSessionMessages(sessionId);
  }
}
