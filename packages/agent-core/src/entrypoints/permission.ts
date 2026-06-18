/** Web BFF：工具权限确认（不牵出 Harness / Provider） */
export {
  resolvePermissionPending,
  initPermissionPending,
  waitForPermissionDecision,
} from '../permission-pending.js';
export type { PermissionWaitOutcome } from '../permission-pending.js';

export {
  assertPermissionSessionKey,
  grantSessionToolAllow,
  isSessionToolAllowed,
} from '../permission-session.js';

export {
  checkPermission,
  resolvePermissionMode,
  buildArgsPreview,
} from '../permission-gate.js';

export type {
  PermissionBehavior,
  PermissionCheckContext,
  PermissionDecision,
  PermissionMode,
  PermissionResolveDecision,
} from '../config/permission.types.js';

export { parsePermissionMode, parseImPermissionMode } from '../config/permission.types.js';
