/**
 * 聊天会话双模式抽象 — 对齐 session-store.js
 */

import { getSession } from '@/lib/auth/session';

import { buildConversationReplay } from './session-conversation';
import type { ChatSessionData, SessionListItem } from './session-data';
import { CHAT_SESSION_ID_PREFIX, type HistoryEntry, type StoredToolCall } from './storage-contract';

const SESSION_MODE = { GUEST: 'guest', AUTHED: 'authed' } as const;
const AUTHED_PAGE_LIMIT = 500;

type SessionMode = (typeof SESSION_MODE)[keyof typeof SESSION_MODE];

interface ServerStoredMessage {
  id: string;
  role: string;
  content: string | null;
  toolCalls: unknown;
  reasoning: string | null;
}

function safeContent(message: { content?: string | null }): string {
  return typeof message.content === 'string' ? message.content : '';
}

function mapServerMessagesToEntries(rows: ServerStoredMessage[]): HistoryEntry[] {
  const entries: HistoryEntry[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) {
      continue;
    }

    if (row.role === 'user') {
      entries.push({ role: 'user', content: safeContent(row) });
      continue;
    }

    if (row.role === 'tool') {
      const toolCalls = row.toolCalls;
      const toolCallId =
        toolCalls &&
        typeof toolCalls === 'object' &&
        !Array.isArray(toolCalls) &&
        typeof (toolCalls as { toolCallId?: string }).toolCallId === 'string'
          ? (toolCalls as { toolCallId: string }).toolCallId
          : undefined;
      entries.push({
        role: 'tool',
        tool_call_id: toolCallId,
        content: safeContent(row),
      });
      continue;
    }

    if (row.role === 'assistant') {
      const openAiToolCalls = Array.isArray(row.toolCalls) ? row.toolCalls : [];
      const richToolCalls: StoredToolCall[] = openAiToolCalls.map((tc) => {
        const item = tc as {
          id?: string;
          function?: { name?: string; arguments?: string };
        };
        const args = item.function?.arguments;
        let parsedArgs: unknown = {};
        try {
          parsedArgs = typeof args === 'string' ? JSON.parse(args) : (args ?? {});
        } catch {
          parsedArgs = args ?? {};
        }
        const resultRow = rows.find(
          (candidate) =>
            candidate.role === 'tool' &&
            candidate.toolCalls &&
            typeof candidate.toolCalls === 'object' &&
            !Array.isArray(candidate.toolCalls) &&
            (candidate.toolCalls as { toolCallId?: string }).toolCallId === item.id
        );
        return {
          id: item.id ?? `tc-${i}`,
          name: item.function?.name ?? '未命名工具',
          source: 'mcp',
          args: parsedArgs,
          result: resultRow ? safeContent(resultRow) : undefined,
          isError: false,
          progressSteps: [],
        };
      });

      entries.push({
        role: 'assistant',
        content: safeContent(row),
        reasoning: row.reasoning ?? undefined,
        reasoning_content: row.reasoning ?? undefined,
        tool_calls: openAiToolCalls.length > 0 ? openAiToolCalls : undefined,
        toolCalls: richToolCalls.length > 0 ? richToolCalls : undefined,
        _toolResultsExpanded: true,
      });
    }
  }

  return entries;
}

export interface SessionStoreCallbacks {
  onSessionChanged?: (sessionId: string) => void;
  onHistoryLoaded?: (entries: HistoryEntry[]) => void;
  onReplayReady?: (items: ReturnType<typeof buildConversationReplay>) => void;
  onResetContext?: () => void;
  onClearPlanning?: () => void;
}

export class ChatSessionStore {
  private mode: SessionMode = SESSION_MODE.GUEST;
  private activeSessionPersisted = false;

  constructor(
    private readonly guestData: ChatSessionData,
    private readonly callbacks: SessionStoreCallbacks = {}
  ) {}

  async init(): Promise<SessionMode> {
    let user = null;
    try {
      user = await getSession();
    } catch {
      user = null;
    }
    this.mode = user ? SESSION_MODE.AUTHED : SESSION_MODE.GUEST;
    return this.mode;
  }

  isAuthed(): boolean {
    return this.mode === SESSION_MODE.AUTHED;
  }

  isValidActiveSessionId(sessionId: string): boolean {
    if (!sessionId) {
      return false;
    }
    if (this.isAuthed()) {
      return true;
    }
    return sessionId.startsWith(CHAT_SESSION_ID_PREFIX) && sessionId !== 'session_NaN';
  }

  displayId(sessionId: string): string {
    if (!sessionId) {
      return this.isAuthed() ? '新会话' : '';
    }
    return sessionId.startsWith(CHAT_SESSION_ID_PREFIX)
      ? sessionId.slice(CHAT_SESSION_ID_PREFIX.length)
      : sessionId;
  }

  private async authedFetch(
    path: string,
    options: RequestInit = {}
  ): Promise<Record<string, unknown>> {
    const response = await fetch(path, { credentials: 'include', ...options });
    const data = (await response.json().catch(() => null)) as {
      success?: boolean;
      error?: string;
    } | null;
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || `HTTP ${response.status}`);
    }
    return data as Record<string, unknown>;
  }

  async listSessions(provider: string | null = null): Promise<SessionListItem[]> {
    if (!this.isAuthed()) {
      return this.guestData.getAllChatSessions(provider);
    }

    const data = await this.authedFetch('/api/sessions');
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    return sessions.map((session) => {
      const item = session as { id: string; title?: string; updatedAt: string };
      return {
        id: item.id,
        displayId: this.displayId(item.id),
        title: item.title || '无标题会话',
        preview: '',
        messageCount: 0,
        lastActive: item.updatedAt,
        timestamp: new Date(item.updatedAt).getTime(),
        provider: '',
      };
    });
  }

  async getSessionMessages(sessionId: string): Promise<HistoryEntry[]> {
    if (!this.isAuthed()) {
      return this.guestData.idb.getSessionMessages(sessionId);
    }

    const data = await this.authedFetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/messages?limit=${AUTHED_PAGE_LIMIT}`
    );
    const messages = Array.isArray(data.messages) ? data.messages : [];
    return mapServerMessagesToEntries(messages as ServerStoredMessage[]);
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.isAuthed()) {
      await this.guestData.deleteSessionMessages(sessionId);
      return;
    }

    await this.authedFetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
    if (sessionId === this.guestData.sessionId) {
      this.activeSessionPersisted = false;
    }
  }

  async loadLatest(): Promise<string> {
    if (!this.isAuthed()) {
      return this.guestData.loadLatestProviderSession();
    }

    const data = await this.authedFetch('/api/sessions');
    const sessions = Array.isArray(data.sessions) ? data.sessions : [];
    const latest = sessions[0] as { id: string } | undefined;
    if (latest) {
      return this.loadSession(latest.id);
    }
    return this.newSession();
  }

  async loadSession(sessionId: string): Promise<string> {
    if (!this.isAuthed()) {
      return this.guestData.loadSession(sessionId);
    }

    this.guestData.isLoading = true;
    this.callbacks.onResetContext?.();
    try {
      const entries = await this.getSessionMessages(sessionId);
      this.guestData.sessionId = sessionId;
      this.activeSessionPersisted = true;
      this.guestData.messageHistory = entries;
      this.callbacks.onSessionChanged?.(sessionId);
      this.callbacks.onHistoryLoaded?.(entries);
      this.callbacks.onReplayReady?.(buildConversationReplay(entries));
      return sessionId;
    } finally {
      this.guestData.isLoading = false;
    }
  }

  newSession(): string {
    if (!this.isAuthed()) {
      return this.guestData.createNewSession();
    }

    this.guestData.sessionId = '';
    this.activeSessionPersisted = false;
    this.callbacks.onResetContext?.();
    this.callbacks.onClearPlanning?.();
    this.guestData.messageHistory = [];
    this.callbacks.onSessionChanged?.('');
    this.callbacks.onHistoryLoaded?.([]);
    return this.guestData.sessionId;
  }

  async ensureActiveSession(): Promise<void> {
    if (!this.isAuthed() || this.activeSessionPersisted) {
      return;
    }

    const data = await this.authedFetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const session = data.session as { id: string };
    this.guestData.sessionId = session.id;
    this.activeSessionPersisted = true;
    this.callbacks.onSessionChanged?.(session.id);
  }
}

export function createSessionStore(
  guestData: ChatSessionData,
  callbacks?: SessionStoreCallbacks
): ChatSessionStore {
  return new ChatSessionStore(guestData, callbacks);
}
