import { ChatStore } from '@meek/chat-store';

function sessionsError(status: number, error: string, details?: string): Response {
  return Response.json(details ? { error, details } : { error }, { status });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function handleListSessions(userId: string): Promise<Response> {
  try {
    const sessions = await ChatStore.listSessions(userId);
    return Response.json({ success: true, sessions });
  } catch (error: unknown) {
    return sessionsError(500, '获取会话列表失败', getErrorMessage(error));
  }
}

export async function handleCreateSession(userId: string, body: unknown): Promise<Response> {
  try {
    const title =
      typeof (body as { title?: unknown })?.title === 'string'
        ? (body as { title: string }).title
        : undefined;
    const session = await ChatStore.createSession(userId, title);
    return Response.json({ success: true, session }, { status: 201 });
  } catch (error: unknown) {
    return sessionsError(500, '创建会话失败', getErrorMessage(error));
  }
}

export async function handleDeleteSession(userId: string, sessionId: string): Promise<Response> {
  if (!sessionId) {
    return sessionsError(400, '参数无效', 'sessionId 不能为空');
  }
  try {
    const deleted = await ChatStore.deleteSession(userId, sessionId);
    if (!deleted) {
      return sessionsError(404, '未找到', '会话不存在或无权访问');
    }
    return Response.json({ success: true });
  } catch (error: unknown) {
    return sessionsError(500, '删除会话失败', getErrorMessage(error));
  }
}

export async function handleGetMessages(
  userId: string,
  sessionId: string,
  searchParams: URLSearchParams,
): Promise<Response> {
  if (!sessionId) {
    return sessionsError(400, '参数无效', 'sessionId 不能为空');
  }
  const cursorRaw = searchParams.get('cursor');
  const limitRaw = searchParams.get('limit');
  const cursor =
    typeof cursorRaw === 'string' && cursorRaw.length > 0 ? cursorRaw : undefined;
  const limit =
    typeof limitRaw === 'string' && Number.isInteger(Number(limitRaw))
      ? Number(limitRaw)
      : undefined;
  try {
    const page = await ChatStore.getMessagesPage(userId, sessionId, { cursor, limit });
    if (!page) {
      return sessionsError(404, '未找到', '会话不存在或无权访问');
    }
    return Response.json({ success: true, ...page });
  } catch (error: unknown) {
    return sessionsError(500, '获取会话消息失败', getErrorMessage(error));
  }
}
