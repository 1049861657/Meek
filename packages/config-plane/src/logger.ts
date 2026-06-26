export function logInfo(scope: string, message: string): void {
  console.info(`[${scope}] ${message}`);
}

export function logWarn(scope: string, message: string): void {
  console.warn(`[${scope}] ${message}`);
}

export function logError(scope: string, message: string, error?: unknown): void {
  console.error(`[${scope}] ${message}`, error);
}
