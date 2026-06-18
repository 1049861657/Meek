import { getIdempotencyRedisConnection } from '@meek/shared';
import { PermissionConfig } from './config/feature-config.js';
import type { PermissionResolveDecision } from './config/permission.types.js';

export type PermissionWaitOutcome = 'approved' | 'denied' | 'timeout';

function decisionKey(requestId: string, toolCallId: string): string {
  return `meek:perm:decision:${requestId}:${toolCallId}`;
}

export async function initPermissionPending(
  requestId: string,
  toolCallId: string
): Promise<void> {
  const redis = getIdempotencyRedisConnection();
  const ttlSec = Math.ceil(PermissionConfig.pendingTimeoutMs / 1000);
  await redis.set(decisionKey(requestId, toolCallId), 'pending', 'EX', ttlSec);
}

export async function resolvePermissionPending(
  requestId: string,
  toolCallId: string,
  decision: PermissionResolveDecision
): Promise<boolean> {
  const redis = getIdempotencyRedisConnection();
  const key = decisionKey(requestId, toolCallId);
  const current = await redis.get(key);
  if (current !== 'pending') {
    return false;
  }
  const ttlSec = Math.ceil(PermissionConfig.pendingTimeoutMs / 1000);
  await redis.set(key, decision, 'EX', ttlSec);
  return true;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

export async function waitForPermissionDecision(
  requestId: string,
  toolCallId: string,
  signal?: AbortSignal
): Promise<PermissionWaitOutcome> {
  const redis = getIdempotencyRedisConnection();
  const key = decisionKey(requestId, toolCallId);
  const deadline = Date.now() + PermissionConfig.pendingTimeoutMs;

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }
    const value = await redis.get(key);
    if (value === 'approve') {
      return 'approved';
    }
    if (value === 'deny') {
      return 'denied';
    }
    await sleep(PermissionConfig.pendingPollMs, signal);
  }

  await redis.set(key, 'deny', 'EX', 60);
  return 'timeout';
}
