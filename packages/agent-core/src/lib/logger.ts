/**
 * 简化控制台 Logger（无 winston）；audit 输出 JSON 行。
 */
export class Logger {
  static info(context: string, message: string): void {
    console.info(`[${context}] ${message}`);
  }

  static error(context: string, message: string, error?: unknown): void {
    let fullMessage = message;
    if (error) {
      if (error instanceof Error) {
        fullMessage += `: ${error.message}`;
      } else {
        fullMessage += `: ${String(error)}`;
      }
    }
    console.error(`[${context}] ${fullMessage}`);
  }

  static warn(context: string, message: string): void {
    console.warn(`[${context}] ${message}`);
  }

  static debug(context: string, message: string): void {
    console.debug(`[${context}] ${message}`);
  }

  static audit(payload: Record<string, unknown>): void {
    console.info(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        ...payload,
      })
    );
  }
}
