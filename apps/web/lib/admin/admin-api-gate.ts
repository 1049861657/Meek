/**
 * M4-02/03 门控：Admin / Users API 未就绪时关闭写操作。
 * M4-02/03 完成后将 `ADMIN_API_READY` 置为 true。
 */

export const ADMIN_API_READY = false;

export function isAdminApiReady(): boolean {
  return ADMIN_API_READY;
}

export const ADMIN_API_GATE_MESSAGE =
  'Admin / Users API 尚未就绪（依赖 M4-02/03）。当前为只读预览；保存与初始化将在 M4 批次启用。';

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
