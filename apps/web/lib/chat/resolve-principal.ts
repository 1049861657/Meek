import { headers } from 'next/headers';

import { auth } from '@/lib/auth';

export interface RequestPrincipal {
  userId: string | undefined;
  configUserId: string | null;
}

/** 解析 Web 请求主体（M4 seed-follow 前：configUserId = userId ?? null） */
export async function resolvePrincipal(): Promise<RequestPrincipal> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userId = session?.user?.id;
  return {
    userId,
    configUserId: userId ?? null,
  };
}
