/**
 * M4-05 Authed 会话 API 已就绪。
 */

export const AUTHED_SESSIONS_API_READY = true;

export function isAuthedSessionsApiReady(): boolean {
  return AUTHED_SESSIONS_API_READY;
}

export const AUTHED_SESSIONS_GATE_MESSAGE = '';

export class AuthedSessionsGateError extends Error {
  constructor() {
    super(AUTHED_SESSIONS_GATE_MESSAGE || '登录会话历史尚未就绪');
    this.name = 'AuthedSessionsGateError';
  }
}
