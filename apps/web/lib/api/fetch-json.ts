import { showToast } from '@/components/ui/toast';

export class FetchJsonError extends Error {
  status?: number;

  constructor(message: string, status?: number, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FetchJsonError';
    this.status = status;
  }
}

export async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      ...init,
    });
  } catch (cause) {
    throw new FetchJsonError(`请求失败: ${url}`, undefined, { cause });
  }

  if (!response.ok) {
    throw new FetchJsonError(`HTTP ${response.status}: ${url}`, response.status);
  }

  return response.json();
}

export async function postApiJson(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
      cache: 'no-store',
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw cause;
    }
    throw new FetchJsonError(`请求失败: ${url}`, undefined, { cause });
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    data = null;
  }

  if (!response.ok || data?.success === false) {
    const message =
      (typeof data?.error === 'string' && data.error) ||
      `HTTP ${response.status}`;
    throw new FetchJsonError(message, response.status);
  }

  return data ?? {};
}

export function isUnauthorizedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error instanceof FetchJsonError && error.status === 401) {
    return true;
  }
  const message = error.message;
  return message.includes('未登录') || message.includes('HTTP 401');
}

export function getApiErrorMessage(error: unknown, fallback = '请求失败'): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export function showApiError(error: unknown, fallback = '请求失败'): void {
  showToast(getApiErrorMessage(error, fallback), 'error');
}
