import { headers } from 'next/headers';

import { resolveConfigUserId } from '@meek/config-plane';

import { auth } from '@/lib/auth';

export interface RequestPrincipal {
  userId: string | undefined;
  configUserId: string | null;
}

/** 解析 Web 请求主体（落库 userId + MCP/Provider 配置池 configUserId） */
export async function resolvePrincipal(): Promise<RequestPrincipal> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userId = session?.user?.id;
  const configUserId = await resolveConfigUserId({ requestUserId: userId });
  return {
    userId,
    configUserId,
  };
}
