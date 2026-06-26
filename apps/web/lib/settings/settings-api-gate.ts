/**
 * M4-04 门控：Settings Provider API 未就绪时关闭写操作。
 * M4-04 完成后将 `SETTINGS_API_READY` 置为 true。
 */

export const SETTINGS_API_READY = false;

export function isSettingsApiReady(): boolean {
  return SETTINGS_API_READY;
}

export const SETTINGS_API_GATE_MESSAGE =
  'Settings Provider API 尚未就绪（依赖 M4-04）。当前为只读预览；保存与导入将在 M4 批次启用。';

export class SettingsApiGateError extends Error {
  constructor() {
    super(SETTINGS_API_GATE_MESSAGE);
    this.name = 'SettingsApiGateError';
  }
}

export function assertSettingsWriteReady(): void {
  if (!isSettingsApiReady()) {
    throw new SettingsApiGateError();
  }
}
