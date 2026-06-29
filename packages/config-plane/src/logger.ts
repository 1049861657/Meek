import { Logger } from '@meek/shared/logger';

export function logInfo(scope: string, message: string): void {
  Logger.info(scope, message);
}

export function logWarn(scope: string, message: string): void {
  Logger.warn(scope, message);
}

export function logError(scope: string, message: string, error?: unknown): void {
  Logger.error(scope, message, error);
}
