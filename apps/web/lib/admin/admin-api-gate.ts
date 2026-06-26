/**
 * M4-02 Admin API 已就绪；Users API 见 M4-03。
 */

export const ADMIN_API_READY = true;

export function isAdminApiReady(): boolean {
  return ADMIN_API_READY;
}

export const ADMIN_API_GATE_MESSAGE =
  'Users API 尚未就绪（依赖 M4-03）。Admin 写操作已开放。';

export class AdminApiGateError extends Error {
  constructor() {
    super(ADMIN_API_GATE_MESSAGE);
    this.name = 'AdminApiGateError';
  }
}

export function assertAdminWriteReady(): void {
  if (!isAdminApiReady()) {
    throw new AdminApiGateError();
  }
}
