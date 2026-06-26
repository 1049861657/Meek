import { headers } from 'next/headers';

import {
  debugPrompt,
  debugRecall,
  debugReflect,
  formatMemoryDebugError,
  getMemoryDebugMeta,
  Logger,
  MemoryDebugUnavailableError,
} from '@meek/agent-core';
import type { MemoryIdentityScope } from '@meek/shared';

import { auth } from '@/lib/auth';

function parseQueryBody(body: unknown): string {
  if (!body || typeof body !== 'object') {
    throw new Error('请求体必须为 JSON 对象');
  }
  const query = (body as { query?: unknown }).query;
  if (typeof query !== 'string' || query.trim().length === 0) {
    throw new Error('query 不能为空');
  }
  return query.trim();
}

async function resolveMemoryScope(): Promise<MemoryIdentityScope | undefined> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userId = session?.user?.id;
  return userId ? { channel: 'web', userId } : undefined;
}

function memoryDebugError(status: number, error: string): Response {
  return Response.json({ success: false, error }, { status });
}

function sendDebugError(action: string, error: unknown): Response {
  if (error instanceof MemoryDebugUnavailableError) {
    return memoryDebugError(503, error.message);
  }

  const message = formatMemoryDebugError(error);
  const status = error instanceof Error && message.includes('不能为空') ? 400 : 502;
  Logger.warn('MEMORY', `debug ${action} failed: ${message}`);
  return memoryDebugError(status, message);
}

export async function handleGetMemoryDebugMeta(): Promise<Response> {
  const scope = await resolveMemoryScope();
  return Response.json({
    success: true,
    ...getMemoryDebugMeta(scope),
  });
}

export async function handleMemoryDebugRecall(body: unknown): Promise<Response> {
  try {
    const query = parseQueryBody(body);
    const scope = await resolveMemoryScope();
    const payload = await debugRecall(query, { scope });
    return Response.json({ success: true, ...payload });
  } catch (error: unknown) {
    return sendDebugError('recall', error);
  }
}

export async function handleMemoryDebugReflect(body: unknown): Promise<Response> {
  try {
    const query = parseQueryBody(body);
    const scope = await resolveMemoryScope();
    const payload = await debugReflect(query, { scope });
    return Response.json({ success: true, ...payload });
  } catch (error: unknown) {
    return sendDebugError('reflect', error);
  }
}

export async function handleMemoryDebugPrompt(body: unknown): Promise<Response> {
  try {
    const query = parseQueryBody(body);
    const scope = await resolveMemoryScope();
    const payload = await debugPrompt(query, { scope });
    return Response.json({ success: true, ...payload });
  } catch (error: unknown) {
    return sendDebugError('prompt', error);
  }
}
