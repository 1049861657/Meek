import { createHash } from 'node:crypto';

import { setAiProvidersConfig } from '../ports/provider-config-port.js';
import type { AIProvidersConfigType } from './provider-types.js';

const fingerprints = new Map<string, string>();

function userKey(userId?: string | null): string {
  return userId ?? 'null';
}

function fingerprint(config: AIProvidersConfigType): string {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

/**
 * 写入 provider 配置端口；仅当该 user 的配置内容变化时返回 true。
 */
export function commitProviderConfig(
  userId: string | null | undefined,
  config: AIProvidersConfigType,
): boolean {
  const key = userKey(userId);
  const next = fingerprint(config);
  if (fingerprints.get(key) === next) {
    return false;
  }
  fingerprints.set(key, next);
  setAiProvidersConfig(config);
  return true;
}

/** 设置页保存/重置：始终写入端口并更新指纹 */
export function forceCommitProviderConfig(
  userId: string | null | undefined,
  config: AIProvidersConfigType,
): void {
  fingerprints.set(userKey(userId), fingerprint(config));
  setAiProvidersConfig(config);
}
