/**
 * M4-04 Settings API 已就绪。
 */

export const SETTINGS_API_READY = true;

export function isSettingsApiReady(): boolean {
  return SETTINGS_API_READY;
}

export const SETTINGS_API_GATE_MESSAGE = '';

export class SettingsApiGateError extends Error {
  constructor() {
    super(SETTINGS_API_GATE_MESSAGE || 'Settings API 尚未就绪');
    this.name = 'SettingsApiGateError';
  }
}

export function assertSettingsWriteReady(): void {
  if (!isSettingsApiReady()) {
    throw new SettingsApiGateError();
  }
}
