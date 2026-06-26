import { headers } from 'next/headers';

import { auth } from '@/lib/auth';

export interface AuthedUser {
  id: string;
  role?: string;
  username?: string | null;
  email?: string | null;
}

/** 需登录：Settings 写操作门控 */
export async function requireAuth(): Promise<AuthedUser | Response> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return Response.json({ error: '未登录', details: '请先登录' }, { status: 401 });
  }
  const user = session.user as {
    id: string;
    role?: string;
    username?: string | null;
    email?: string | null;
  };
  return {
    id: user.id,
    role: user.role,
    username: user.username ?? null,
    email: user.email ?? null,
  };
}
