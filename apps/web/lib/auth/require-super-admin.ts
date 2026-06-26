import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import { SUPERADMIN_ROLE } from '@/lib/auth/constants';

export interface SuperAdminUser {
  id: string;
  role: string;
  username: string | null;
  email: string | null;
}

/** 仅 SUPERADMIN：Admin / Users API 门控 */
export async function requireSuperAdmin(): Promise<SuperAdminUser | Response> {
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
  if (user.role !== SUPERADMIN_ROLE) {
    return Response.json({ error: '无权限', details: '仅超级管理员可操作' }, { status: 403 });
  }
  return {
    id: user.id,
    role: user.role ?? SUPERADMIN_ROLE,
    username: user.username ?? null,
    email: user.email ?? null,
  };
}
