/**
 * 客户端权限确认 — 对齐 stream-handler resolveToolPermission
 */

export interface PermissionResolveInput {
  requestId: string;
  toolCallId: string;
  decision: 'approve' | 'deny';
  alwaysAllowSession: boolean;
  codeName: string;
  permissionSessionKey: string;
}

export async function resolveChatToolPermission(input: PermissionResolveInput): Promise<boolean> {
  if (!input.requestId) {
    console.warn('[permission] 缺少 requestId，无法确认');
    return false;
  }
  if (!input.permissionSessionKey.length) {
    console.warn('[permission] 缺少 permissionSessionKey，无法确认');
    return false;
  }

  try {
    const res = await fetch('/api/chat/permission-resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: input.requestId,
        toolCallId: input.toolCallId,
        decision: input.decision,
        alwaysAllowSession: input.alwaysAllowSession,
        sessionKey: input.permissionSessionKey,
        codeName: input.codeName,
      }),
    });
    const data = (await res.json()) as { success?: boolean };
    if (!res.ok || !data.success) {
      console.warn('[permission] resolve 失败', data);
      return false;
    }
    return true;
  } catch (error: unknown) {
    console.error('[permission] resolve 请求异常', error);
    return false;
  }
}
