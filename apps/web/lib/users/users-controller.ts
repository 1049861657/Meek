import {
  getSeedFollowState,
  setSeedFollowUserId,
} from '@meek/config-plane';
import { prisma } from '@meek/db';

import { SUPERADMIN_ROLE, USER_ROLE } from '@/lib/auth/constants';
import { hashPassword } from '@/lib/password-hasher';

const CREDENTIAL_PROVIDER_ID = 'credential';

function usersError(status: number, error: string, details: string): Response {
  return Response.json({ error, details }, { status });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function handleListUsers(): Promise<Response> {
  try {
    const rows = await prisma.user.findMany({
      select: { id: true, username: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    return Response.json(rows);
  } catch (error: unknown) {
    return usersError(500, '获取用户列表失败', getErrorMessage(error));
  }
}

export async function handleSetRole(
  userId: string,
  body: unknown,
  currentUserId: string,
): Promise<Response> {
  if (!userId) {
    return usersError(400, '参数无效', 'userId 不能为空');
  }
  const role = (body as { role?: unknown })?.role;
  if (role !== SUPERADMIN_ROLE && role !== USER_ROLE) {
    return usersError(400, '参数无效', `role 仅允许 ${SUPERADMIN_ROLE} / ${USER_ROLE}`);
  }
  try {
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return usersError(404, '未找到', '用户不存在');
    }
    if (target.role === SUPERADMIN_ROLE && role === USER_ROLE) {
      if (currentUserId === userId) {
        return usersError(403, '禁止操作', '不可降级自己的超级管理员角色');
      }
      const superadminCount = await prisma.user.count({ where: { role: SUPERADMIN_ROLE } });
      if (superadminCount <= 1) {
        return usersError(403, '禁止操作', '系统须保留至少一名超级管理员');
      }
    }
    await prisma.user.update({ where: { id: userId }, data: { role } });
    console.info(`[USERS] 用户 ${userId} 角色改为 ${role}`);
    return Response.json({ success: true });
  } catch (error: unknown) {
    return usersError(500, '修改角色失败', getErrorMessage(error));
  }
}

export async function handleGetSeedFollow(): Promise<Response> {
  try {
    const state = await getSeedFollowState();
    return Response.json(state);
  } catch (error: unknown) {
    return usersError(500, '获取默认配置归属失败', getErrorMessage(error));
  }
}

export async function handleSetSeedFollow(body: unknown): Promise<Response> {
  const userId = (body as { userId?: unknown })?.userId;
  if (userId !== null && (typeof userId !== 'string' || !userId.trim())) {
    return usersError(400, '参数无效', 'userId 须为字符串或 null');
  }
  try {
    await setSeedFollowUserId(userId === null ? null : userId.trim());
    const state = await getSeedFollowState();
    return Response.json({ success: true, ...state });
  } catch (error: unknown) {
    return usersError(500, '保存默认配置归属失败', getErrorMessage(error));
  }
}

export async function handleResetPassword(userId: string, body: unknown): Promise<Response> {
  if (!userId) {
    return usersError(400, '参数无效', 'userId 不能为空');
  }
  const password = (body as { password?: unknown })?.password;
  if (typeof password !== 'string' || password.length < 8) {
    return usersError(400, '参数无效', '密码至少 8 位');
  }
  try {
    const account = await prisma.account.findFirst({
      where: { userId, providerId: CREDENTIAL_PROVIDER_ID },
    });
    if (!account) {
      return usersError(404, '未找到', '该用户无密码账号');
    }
    const hashed = await hashPassword(password);
    await prisma.$transaction([
      prisma.account.update({ where: { id: account.id }, data: { password: hashed } }),
      prisma.session.deleteMany({ where: { userId } }),
    ]);
    console.info(`[USERS] 重置用户 ${userId} 密码并吊销其会话`);
    return Response.json({ success: true });
  } catch (error: unknown) {
    return usersError(500, '重置密码失败', getErrorMessage(error));
  }
}
