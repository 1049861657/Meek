/**
 * IndexedDB 读写层 — 对齐 session-idb.js
 */

import {
  CHAT_DB_INDEX_PROVIDER,
  CHAT_DB_INDEX_SESSION,
  CHAT_DB_INDEX_TIMESTAMP,
  CHAT_DB_NAME,
  CHAT_DB_VERSION,
  CHAT_MESSAGES_STORE,
  type ChatIdbMessageRecord,
  type HistoryEntry,
} from './storage-contract';

export interface ChatIdbState {
  instance: IDBDatabase | null;
  name: string;
  version: number;
  isReady: boolean;
}

function hasPersistablePayload(message: HistoryEntry): boolean {
  return Boolean(
    message &&
      ((message.content != null && message.content !== '') ||
        message.role === 'tool' ||
        (message.role === 'assistant' &&
          Boolean(message.tool_calls?.length || message.toolCalls?.length)))
  );
}

export class ChatSessionIdb {
  readonly db: ChatIdbState = {
    instance: null,
    name: CHAT_DB_NAME,
    version: CHAT_DB_VERSION,
    isReady: false,
  };

  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;

  whenReady(): Promise<void> {
    if (this.db.isReady || typeof indexedDB === 'undefined') {
      return Promise.resolve();
    }
    if (!this.readyPromise) {
      this.readyPromise = new Promise<void>((resolve) => {
        this.resolveReady = resolve;
      });
    }
    return this.readyPromise;
  }

  private markReady(): void {
    this.resolveReady?.();
    this.resolveReady = null;
    this.readyPromise = null;
  }

  initDatabase(onReady?: () => void): void {
    if (typeof indexedDB === 'undefined') {
      this.db.isReady = false;
      this.markReady();
      return;
    }

    const request = indexedDB.open(this.db.name, this.db.version);

    request.onerror = () => {
      console.error('打开IndexedDB失败:', request.error);
      this.db.isReady = false;
      this.markReady();
    };

    request.onsuccess = () => {
      this.db.instance = request.result;
      this.db.isReady = true;
      this.markReady();
      onReady?.();
    };

    request.onupgradeneeded = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;

      if (!idb.objectStoreNames.contains(CHAT_MESSAGES_STORE)) {
        const store = idb.createObjectStore(CHAT_MESSAGES_STORE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex(CHAT_DB_INDEX_SESSION, 'sessionId', { unique: false });
        store.createIndex(CHAT_DB_INDEX_TIMESTAMP, 'timestamp', { unique: false });
        store.createIndex(CHAT_DB_INDEX_PROVIDER, 'provider', { unique: false });
      } else {
        const transaction = (event.target as IDBOpenDBRequest).transaction;
        if (!transaction) {
          return;
        }
        const store = transaction.objectStore(CHAT_MESSAGES_STORE);
        if (!store.indexNames.contains(CHAT_DB_INDEX_PROVIDER)) {
          store.createIndex(CHAT_DB_INDEX_PROVIDER, 'provider', { unique: false });
        }
      }
    };
  }

  getSessionMessages(sessionId: string, limit = 0): Promise<ChatIdbMessageRecord[]> {
    return new Promise((resolve, reject) => {
      if (!this.db.isReady || !this.db.instance) {
        reject(new Error('数据库未就绪'));
        return;
      }

      try {
        const transaction = this.db.instance.transaction([CHAT_MESSAGES_STORE], 'readonly');
        const store = transaction.objectStore(CHAT_MESSAGES_STORE);
        const index = store.index(CHAT_DB_INDEX_SESSION);
        const request = index.openCursor(IDBKeyRange.only(sessionId));
        const messages: ChatIdbMessageRecord[] = [];

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            messages.push(cursor.value as ChatIdbMessageRecord);
            cursor.continue();
          } else {
            messages.sort((a, b) => a.timestamp - b.timestamp);
            resolve(limit > 0 ? messages.slice(-limit) : messages);
          }
        };

        request.onerror = () => {
          reject(request.error ?? new Error('查询会话消息失败'));
        };
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  deleteSessionMessages(sessionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db.isReady || !this.db.instance) {
        reject(new Error('数据库未就绪'));
        return;
      }
      if (!sessionId) {
        reject(new Error('无效的会话ID'));
        return;
      }

      try {
        const transaction = this.db.instance.transaction([CHAT_MESSAGES_STORE], 'readwrite');
        const store = transaction.objectStore(CHAT_MESSAGES_STORE);
        const index = store.index(CHAT_DB_INDEX_SESSION);
        const request = index.openCursor(IDBKeyRange.only(sessionId));
        const messageIds: number[] = [];

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const value = cursor.value as ChatIdbMessageRecord;
            if (typeof value.id === 'number') {
              messageIds.push(value.id);
            }
            cursor.continue();
          } else if (messageIds.length === 0) {
            resolve();
          } else {
            let deletedCount = 0;
            const deleteComplete = (): void => {
              if (++deletedCount === messageIds.length) {
                resolve();
              }
            };
            for (const id of messageIds) {
              const deleteRequest = store.delete(id);
              deleteRequest.onsuccess = deleteComplete;
              deleteRequest.onerror = deleteComplete;
            }
          }
        };

        request.onerror = () => {
          reject(request.error ?? new Error('查询要删除的消息失败'));
        };
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  saveChatMessage(
    message: HistoryEntry,
    sessionId: string,
    provider: string
  ): Promise<ChatIdbMessageRecord> {
    if (!this.db.isReady || !this.db.instance) {
      return Promise.reject(new Error('数据库未就绪'));
    }
    if (!hasPersistablePayload(message) || !sessionId) {
      return Promise.reject(new Error('无效的消息或会话ID'));
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.instance!.transaction([CHAT_MESSAGES_STORE], 'readwrite');
        const store = transaction.objectStore(CHAT_MESSAGES_STORE);
        const messageToStore: ChatIdbMessageRecord = {
          ...message,
          sessionId,
          timestamp: Date.now(),
          provider,
        };
        const request = store.add(messageToStore);

        request.onsuccess = () => {
          resolve(messageToStore);
        };

        request.onerror = () => {
          reject(request.error ?? new Error('保存消息到数据库失败'));
        };
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  loadChatHistory(sessionId: string, limit = 50): Promise<ChatIdbMessageRecord[]> {
    if (!this.db.isReady || !this.db.instance) {
      return Promise.reject(new Error('数据库未就绪'));
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.instance!.transaction([CHAT_MESSAGES_STORE], 'readonly');
        const store = transaction.objectStore(CHAT_MESSAGES_STORE);
        const index = store.index(CHAT_DB_INDEX_SESSION);
        const request = index.openCursor(IDBKeyRange.only(sessionId), 'prev');
        const messages: ChatIdbMessageRecord[] = [];
        let counter = 0;

        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor && counter < limit) {
            messages.push(cursor.value as ChatIdbMessageRecord);
            counter++;
            cursor.continue();
          } else {
            messages.sort((a, b) => a.timestamp - b.timestamp);
            resolve(messages);
          }
        };

        request.onerror = () => {
          reject(request.error ?? new Error('加载消息历史失败'));
        };
      } catch (error: unknown) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}

export function createGuestSessionId(): string {
  const now = new Date();
  const dateStr =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0');
  const randomId = Math.floor(1000 + Math.random() * 9000);
  return `session_${dateStr}-${randomId}`;
}
