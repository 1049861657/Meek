import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import pino, { type Logger as PinoLogger } from 'pino';
import pretty from 'pino-pretty';
import { findMonorepoRoot } from './root-env.js';

const LOG_LEVELS = new Set(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

function resolveLogLevel(): string {
  const fromEnv = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (fromEnv && LOG_LEVELS.has(fromEnv)) {
    return fromEnv;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function resolveLogFilePath(): string | undefined {
  const fromEnv = process.env.LOG_FILE?.trim();
  if (fromEnv) {
    return resolve(fromEnv);
  }
  if (process.env.LOG_TO_FILE === '1') {
    const root = findMonorepoRoot(process.cwd());
    return resolve(root, 'logs', 'app.log');
  }
  return undefined;
}

function createRootLogger(): PinoLogger {
  const level = resolveLogLevel();
  const logFile = resolveLogFilePath();
  const isDev = process.env.NODE_ENV !== 'production';

  const prettyStream = isDev
    ? pretty({
        colorize: true,
        translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
        ignore: 'pid,hostname,context',
        singleLine: true,
        messageFormat: '[{context}] {msg}',
      })
    : undefined;

  if (logFile) {
    mkdirSync(dirname(logFile), { recursive: true });
    const fileStream = pino.destination({ dest: logFile, sync: false, mkdir: true });
    if (prettyStream) {
      return pino({ level }, pino.multistream([{ stream: prettyStream }, { stream: fileStream }]));
    }
    return pino({ level }, fileStream);
  }

  if (prettyStream) {
    return pino({ level }, prettyStream);
  }

  return pino({ level });
}

const rootLogger = createRootLogger();

export function createLogger(context: string): PinoLogger {
  return rootLogger.child({ context });
}

export class Logger {
  static info(context: string, message: string): void {
    rootLogger.info({ context }, message);
  }

  static error(context: string, message: string, error?: unknown): void {
    if (error instanceof Error) {
      rootLogger.error({ context, err: error }, message);
      return;
    }
    if (error !== undefined) {
      rootLogger.error({ context, err: String(error) }, message);
      return;
    }
    rootLogger.error({ context }, message);
  }

  static warn(context: string, message: string): void {
    rootLogger.warn({ context }, message);
  }

  static debug(context: string, message: string): void {
    rootLogger.debug({ context }, message);
  }

  static audit(payload: Record<string, unknown>): void {
    rootLogger.info({ context: 'AUDIT', ...payload });
  }
}
