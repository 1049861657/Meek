import { getIdempotencyRedisConnection } from '@meek/shared';

import { PermissionConfig } from './config/feature-config.js';



const PERMISSION_SESSION_PREFIXES = ['web-chat:', 'feishu:', 'dingtalk:'] as const;



function sessionAllowKey(sessionKey: string, codeName: string): string {

  return `meek:perm:session:${sessionKey}:${codeName}`;

}



/** 校验权限会话键格式（grant / check 共用） */

export function assertPermissionSessionKey(sessionKey: string): string {

  const trimmed = sessionKey.trim();

  if (!trimmed) {

    throw new Error('permission sessionKey 为空');

  }

  const valid = PERMISSION_SESSION_PREFIXES.some((prefix) => trimmed.startsWith(prefix));

  if (!valid) {

    throw new Error(`无效的 permission sessionKey: ${trimmed}`);

  }

  return trimmed;

}



/** 本会话始终允许（仅确认模式 interactive） */

export async function isSessionToolAllowed(

  sessionKey: string,

  codeName: string

): Promise<boolean> {

  const key = assertPermissionSessionKey(sessionKey);

  const redis = getIdempotencyRedisConnection();

  const value = await redis.get(sessionAllowKey(key, codeName));

  return value === '1';

}



export async function grantSessionToolAllow(

  sessionKey: string,

  codeName: string

): Promise<void> {

  const key = assertPermissionSessionKey(sessionKey);

  const redis = getIdempotencyRedisConnection();

  const ttlSec = Math.ceil(PermissionConfig.sessionAllowTtlMs / 1000);

  await redis.set(sessionAllowKey(key, codeName), '1', 'EX', ttlSec);

}


