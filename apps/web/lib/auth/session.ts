const AUTH_BASE = '/api/auth';

const AUTH_ERROR_TEXT: Record<string, string> = {
  INVALID_USERNAME_OR_PASSWORD: '用户名或密码错误',
  USERNAME_IS_ALREADY_TAKEN: '该用户名已被注册',
  USERNAME_TOO_SHORT: '用户名太短',
  USERNAME_TOO_LONG: '用户名太长',
  INVALID_USERNAME: '用户名格式不正确',
  INVALID_DISPLAY_USERNAME: '显示用户名格式不正确',
  UNEXPECTED_ERROR: '发生未知错误，请稍后再试',
  INVALID_EMAIL_OR_PASSWORD: '邮箱或密码错误',
  INVALID_EMAIL: '邮箱格式不正确',
  INVALID_PASSWORD: '密码错误',
  PASSWORD_TOO_SHORT: '密码太短',
  PASSWORD_TOO_LONG: '密码太长',
  PASSWORD_ALREADY_SET: '密码已设置',
  USER_ALREADY_HAS_PASSWORD: '该用户已设置密码',
  EMAIL_NOT_VERIFIED: '邮箱未验证',
  USER_NOT_FOUND: '用户不存在',
  USER_ALREADY_EXISTS: '该账号已存在',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: '该账号已存在',
  ACCOUNT_NOT_FOUND: '账户不存在',
  CREDENTIAL_ACCOUNT_NOT_FOUND: '未找到密码登录账户',
  FAILED_TO_CREATE_USER: '创建用户失败',
  FAILED_TO_UPDATE_USER: '更新用户失败',
  FAILED_TO_CREATE_SESSION: '创建会话失败',
  FAILED_TO_GET_SESSION: '获取会话失败',
  SESSION_EXPIRED: '会话已过期，请重新登录',
  INVALID_TOKEN: '令牌无效',
  TOKEN_EXPIRED: '令牌已过期',
  VALIDATION_ERROR: '输入校验失败',
  MISSING_FIELD: '缺少必填字段',
};

const SIGN_IN_COLLAPSE = new Set([
  'INVALID_USERNAME_OR_PASSWORD',
  'INVALID_EMAIL_OR_PASSWORD',
  'USER_NOT_FOUND',
  'INVALID_PASSWORD',
  'INVALID_EMAIL',
  'USERNAME_TOO_SHORT',
  'USERNAME_TOO_LONG',
  'INVALID_USERNAME',
  'INVALID_DISPLAY_USERNAME',
  'CREDENTIAL_ACCOUNT_NOT_FOUND',
  'ACCOUNT_NOT_FOUND',
]);

export interface AuthUser {
  id: string;
  email: string;
  username: string | null;
  role: string | null;
  name?: string;
}

export interface DeviceSession {
  session: { token: string };
  user: AuthUser;
}

interface AuthErrorPayload {
  code?: string;
  message?: string;
  error?: { message?: string } | string;
}

function localizeAuthError(
  data: AuthErrorPayload | null,
  status: number,
  signIn: boolean,
): string {
  const code = typeof data?.code === 'string' ? data.code : '';
  if (signIn && SIGN_IN_COLLAPSE.has(code)) {
    return '用户名或密码错误';
  }
  if (code && AUTH_ERROR_TEXT[code]) {
    return AUTH_ERROR_TEXT[code];
  }
  const raw = data?.message ?? data?.error;
  if (typeof raw === 'string' && raw) {
    return raw;
  }
  if (raw && typeof raw === 'object' && typeof raw.message === 'string' && raw.message) {
    return raw.message;
  }
  return `请求失败(${status})`;
}

async function postAuth(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${AUTH_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  let data: AuthErrorPayload | null = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text) as AuthErrorPayload;
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    throw new Error(localizeAuthError(data, res.status, path.includes('/sign-in')));
  }

  return data;
}

export async function getSession(): Promise<AuthUser | null> {
  const res = await fetch(`${AUTH_BASE}/get-session`, { credentials: 'include' });
  if (!res.ok) {
    return null;
  }
  const data = (await res.json().catch(() => null)) as { user?: AuthUser } | null;
  return data?.user ?? null;
}

export async function signIn(username: string, password: string): Promise<unknown> {
  return postAuth('/sign-in/username', { username, password });
}

export async function signUp(
  email: string,
  username: string,
  password: string,
): Promise<unknown> {
  return postAuth('/sign-up/email', { email, username, password, name: username });
}

export async function signOut(): Promise<unknown> {
  return postAuth('/sign-out', {});
}

export async function listDeviceSessions(): Promise<DeviceSession[]> {
  const res = await fetch(`${AUTH_BASE}/multi-session/list-device-sessions`, {
    credentials: 'include',
  });
  if (!res.ok) {
    return [];
  }
  const data = await res.json().catch(() => null);
  return Array.isArray(data) ? (data as DeviceSession[]) : [];
}

export async function setActiveSession(sessionToken: string): Promise<unknown> {
  return postAuth('/multi-session/set-active', { sessionToken });
}

export function displayAuthName(user: AuthUser): string {
  return (
    user.username?.trim() ||
    user.name?.trim() ||
    user.email.split('@')[0] ||
    '用户'
  );
}
