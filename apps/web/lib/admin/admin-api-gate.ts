/**
 * Admin / Users API 门控（M4-02 + M4-03 已就绪）。
 */

export const ADMIN_API_READY = true;

export function isAdminApiReady(): boolean {
  return ADMIN_API_READY;
}

export const ADMIN_API_GATE_MESSAGE = '';

export class AdminApiGateError extends Error {
  constructor() {
    super(ADMIN_API_GATE_MESSAGE || 'Admin API 尚未就绪');
    this.name = 'AdminApiGateError';
  }
}

export function assertAdminWriteReady(): void {
  if (!isAdminApiReady()) {
    throw new AdminApiGateError();
  }
}
