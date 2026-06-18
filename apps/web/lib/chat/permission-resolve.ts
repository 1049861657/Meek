import {
  assertPermissionSessionKey,
  grantSessionToolAllow,
  resolvePermissionPending,
  type PermissionResolveDecision,
} from '@meek/agent-core/permission';

export interface PermissionResolveBody {
  requestId?: unknown;
  toolCallId?: unknown;
  decision?: unknown;
  alwaysAllowSession?: unknown;
  sessionKey?: unknown;
  codeName?: unknown;
}

export interface PermissionResolveSuccess {
  success: true;
  requestId: string;
  toolCallId: string;
  decision: PermissionResolveDecision;
}

export interface PermissionResolveFailure {
  success: false;
  error: string;
}

export type PermissionResolveResponse = PermissionResolveSuccess | PermissionResolveFailure;

export interface PermissionResolveHttpResult {
  status: number;
  body: PermissionResolveResponse;
}

function parseDecision(value: unknown): PermissionResolveDecision | null {
  if (value === 'approve' || value === 'deny') {
    return value;
  }
  return null;
}

/**
 * P1-03：用户确认 pending 工具调用（对齐 MCP-Client ai.controller permissionResolve）
 */
export async function handlePermissionResolve(
  body: PermissionResolveBody
): Promise<PermissionResolveHttpResult> {
  const requestId = typeof body.requestId === 'string' ? body.requestId : '';
  const toolCallId = typeof body.toolCallId === 'string' ? body.toolCallId : '';
  const decision = parseDecision(body.decision);

  if (!requestId || !toolCallId || !decision) {
    return {
      status: 400,
      body: { success: false, error: '缺少 requestId、toolCallId 或 decision' },
    };
  }

  const applied = await resolvePermissionPending(requestId, toolCallId, decision);
  if (!applied) {
    return {
      status: 409,
      body: { success: false, error: '确认已处理或已过期' },
    };
  }

  if (decision === 'approve' && body.alwaysAllowSession === true) {
    if (typeof body.sessionKey !== 'string' || typeof body.codeName !== 'string') {
      return {
        status: 400,
        body: { success: false, error: '记住此工具需要 sessionKey 与 codeName' },
      };
    }
    await grantSessionToolAllow(
      assertPermissionSessionKey(body.sessionKey),
      body.codeName
    );
  }

  return {
    status: 200,
    body: { success: true, requestId, toolCallId, decision },
  };
}
