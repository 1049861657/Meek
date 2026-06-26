/**
 * M4-05 门控：Authed 会话 API 未就绪时关闭服务端会话读写。
 * M4-05 完成后将 `AUTHED_SESSIONS_API_READY` 置为 true。
 */

export const AUTHED_SESSIONS_API_READY = false;

export function isAuthedSessionsApiReady(): boolean {
  return AUTHED_SESSIONS_API_READY;
}

export const AUTHED_SESSIONS_GATE_MESSAGE =
  '登录会话历史尚未就绪（依赖 M4-05 Sessions API）。Guest 模式功能完整；登录后仍可聊天，服务端会话持久化将在 M4 批次启用。';

export class AuthedSessionsGateError extends Error {
  constructor() {
    super(AUTHED_SESSIONS_GATE_MESSAGE);
    this.name = 'AuthedSessionsGateError';
  }
}
