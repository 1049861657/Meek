/**
 * 聊天持久化（仅已登录用户；guest 走浏览器 IndexedDB 不入库）。
 * append-only：消息写入后不更新不删除，仅随会话级联删除。
 */
import type { InternalMessage } from '@meek/agent-core';
import { prisma } from '@meek/db';

const DEFAULT_MESSAGE_HISTORY_COUNT = 20;
const MESSAGES_PAGE_SIZE = 50;

/** 服务端压缩基线：摘要 + 边界时刻（晚于此时刻的消息为 tail） */
export interface CompactBaseline {
  summaryContent: string;
  compactedAt: string;
}

/** 会话摘要（列表用） */
export interface ChatSessionSummary {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 消息分页结果（只读展示用） */
export interface ChatMessagePage {
  messages: StoredChatMessage[];
  nextCursor: string | null;
}

/** 持久化消息的对外形态 */
export interface StoredChatMessage {
  id: string;
  role: string;
  content: string | null;
  toolCalls: unknown;
  reasoning: string | null;
  createdAt: Date;
}

interface ContextAssembleOptions {
  messageHistoryCount?: number;
}

const PERSIST_EXCLUDE_SOURCES: ReadonlySet<string> = new Set([
  'persisted',
  'hook',
  'reminder',
  'summary',
  'compact',
  'system',
]);

const PERSISTABLE_ROLES: ReadonlySet<string> = new Set(['user', 'assistant', 'tool']);

const TITLE_MAX_CHARS = 40;

function isCompactBaseline(value: unknown): value is CompactBaseline {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).summaryContent === 'string' &&
    typeof (value as Record<string, unknown>).compactedAt === 'string'
  );
}

function messageContentText(content: InternalMessage['content']): string | null {
  return typeof content === 'string' ? content : null;
}

function mapRowToStored(row: {
  id: string;
  role: string;
  content: string | null;
  toolCallsJson: unknown;
  reasoning: string | null;
  createdAt: Date;
}): StoredChatMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    toolCalls: row.toolCallsJson ?? null,
    reasoning: row.reasoning,
    createdAt: row.createdAt,
  };
}

function rowToInternalMessage(row: StoredChatMessage): InternalMessage {
  if (row.role === 'assistant') {
    return {
      role: 'assistant',
      content: row.content,
      _source: 'persisted',
      ...(Array.isArray(row.toolCalls) ? { tool_calls: row.toolCalls } : {}),
      ...(row.reasoning ? { reasoning_content: row.reasoning } : {}),
    } as InternalMessage;
  }

  if (row.role === 'tool') {
    const toolCallId =
      row.toolCalls && typeof row.toolCalls === 'object' && !Array.isArray(row.toolCalls)
        ? (row.toolCalls as Record<string, unknown>).toolCallId
        : undefined;
    return {
      role: 'tool',
      content: row.content ?? '',
      tool_call_id: typeof toolCallId === 'string' ? toolCallId : '',
      _source: 'persisted',
    } as InternalMessage;
  }

  return { role: 'user', content: row.content ?? '', _source: 'persisted' };
}

function internalMessageToCreateData(message: InternalMessage): {
  sessionId: string;
  role: string;
  content: string | null;
  toolCallsJson: unknown;
  reasoning: string | null;
} | null {
  const content = messageContentText(message.content);

  if (message.role === 'assistant') {
    const toolCalls = (message as { tool_calls?: unknown }).tool_calls;
    const hasToolCalls = Array.isArray(toolCalls) && toolCalls.length > 0;
    if (!content && !hasToolCalls) {
      return null;
    }
    return {
      sessionId: '',
      role: 'assistant',
      content,
      toolCallsJson: hasToolCalls ? toolCalls : null,
      reasoning: message.reasoning_content ?? null,
    };
  }

  if (message.role === 'tool') {
    const toolCallId = (message as { tool_call_id?: unknown }).tool_call_id;
    return {
      sessionId: '',
      role: 'tool',
      content,
      toolCallsJson:
        typeof toolCallId === 'string' && toolCallId.length > 0 ? { toolCallId } : null,
      reasoning: null,
    };
  }

  if (!content) {
    return null;
  }
  return { sessionId: '', role: 'user', content, toolCallsJson: null, reasoning: null };
}

function shouldPersist(message: InternalMessage): boolean {
  if (!PERSISTABLE_ROLES.has(message.role)) {
    return false;
  }
  const source = message._source;
  return !(typeof source === 'string' && PERSIST_EXCLUDE_SOURCES.has(source));
}

function deriveTitle(messages: InternalMessage[]): string | null {
  for (const message of messages) {
    if (message.role !== 'user') {
      continue;
    }
    const text = messageContentText(message.content)?.trim();
    if (text) {
      return text.length > TITLE_MAX_CHARS ? `${text.slice(0, TITLE_MAX_CHARS)}…` : text;
    }
  }
  return null;
}

export class ChatStore {
  static async listSessions(userId: string): Promise<ChatSessionSummary[]> {
    return prisma.chatSession.findMany({
      where: { userId },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  static async createSession(userId: string, title?: string): Promise<ChatSessionSummary> {
    return prisma.chatSession.create({
      data: { userId, title: title?.trim() || null },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  static async deleteSession(userId: string, sessionId: string): Promise<boolean> {
    const result = await prisma.chatSession.deleteMany({ where: { id: sessionId, userId } });
    return result.count > 0;
  }

  static async getOwnedSession(
    userId: string,
    sessionId: string,
  ): Promise<{ id: string; title: string | null; compactBaseline: CompactBaseline | null } | null> {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true, title: true, compactBaselineJson: true },
    });
    if (!session) {
      return null;
    }
    return {
      id: session.id,
      title: session.title,
      compactBaseline: isCompactBaseline(session.compactBaselineJson)
        ? {
            summaryContent: session.compactBaselineJson.summaryContent,
            compactedAt: session.compactBaselineJson.compactedAt,
          }
        : null,
    };
  }

  static async getMessagesPage(
    userId: string,
    sessionId: string,
    options: { cursor?: string; limit?: number } = {},
  ): Promise<ChatMessagePage | null> {
    const owned = await ChatStore.getOwnedSession(userId, sessionId);
    if (!owned) {
      return null;
    }

    const limit =
      options.limit && options.limit > 0 ? options.limit : MESSAGES_PAGE_SIZE;
    const rows = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
      ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
      select: {
        id: true,
        role: true,
        content: true,
        toolCallsJson: true,
        reasoning: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      messages: page.map(mapRowToStored),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  static async assembleContextMessages(
    userId: string,
    sessionId: string,
    options: ContextAssembleOptions = {},
  ): Promise<InternalMessage[]> {
    const owned = await ChatStore.getOwnedSession(userId, sessionId);
    if (!owned) {
      throw new Error('会话不存在或无权访问');
    }

    const rows = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        role: true,
        content: true,
        toolCallsJson: true,
        reasoning: true,
        createdAt: true,
      },
    });
    const stored = rows.map(mapRowToStored);

    if (owned.compactBaseline) {
      const boundary = new Date(owned.compactBaseline.compactedAt).getTime();
      const tail = stored.filter((row) => row.createdAt.getTime() > boundary);
      return [
        { role: 'user', content: owned.compactBaseline.summaryContent, _source: 'persisted' },
        ...tail.map(rowToInternalMessage),
      ];
    }

    const count =
      options.messageHistoryCount && options.messageHistoryCount > 0
        ? options.messageHistoryCount
        : DEFAULT_MESSAGE_HISTORY_COUNT;
    return stored.slice(-count).map(rowToInternalMessage);
  }

  static async appendTurnMessages(
    userId: string,
    sessionId: string,
    messages: InternalMessage[],
  ): Promise<void> {
    const data = messages
      .filter(shouldPersist)
      .map(internalMessageToCreateData)
      .filter((row): row is NonNullable<ReturnType<typeof internalMessageToCreateData>> => row !== null)
      .map((row) => ({ ...row, sessionId }));

    if (data.length === 0) {
      return;
    }

    await prisma.$transaction(async (tx) => {
      const session = await tx.chatSession.findFirst({
        where: { id: sessionId, userId },
        select: { title: true },
      });
      if (!session) {
        throw new Error(`落库失败：会话不存在或无权访问 sessionId=${sessionId}`);
      }

      await tx.chatMessage.createMany({ data: data as never });

      const title = session.title ? null : deriveTitle(messages);
      await tx.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date(), ...(title ? { title } : {}) },
      });
    });
  }

  static async updateCompactBaseline(
    userId: string,
    sessionId: string,
    baseline: CompactBaseline,
  ): Promise<void> {
    const result = await prisma.chatSession.updateMany({
      where: { id: sessionId, userId },
      data: { compactBaselineJson: baseline as never },
    });
    if (result.count === 0) {
      throw new Error(`压缩基线回写失败：会话不存在或无权访问 sessionId=${sessionId}`);
    }
  }
}

/** agent-core ChatStorePort 适配 */
export const chatStorePort = {
  appendTurnMessages: ChatStore.appendTurnMessages.bind(ChatStore),
  updateCompactBaseline: ChatStore.updateCompactBaseline.bind(ChatStore),
};
