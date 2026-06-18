import { RecoveryConfig } from './config/feature-config.js';
import { Logger } from './lib/logger.js';

export type LlmErrorKind = 'abort' | 'fail_fast' | 'transient' | 'unknown';

const FAIL_FAST_HTTP_STATUSES = new Set([400, 401, 403, 404, 422]);

const TRANSIENT_HTTP_STATUSES = new Set([429, 500, 502, 503, 504, 529]);

const TRANSIENT_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EAI_AGAIN'
]);

const CONTEXT_FAIL_FAST_PATTERNS = [
  'context_length',
  'context length',
  'maximum context',
  'max context',
  'prompt is too long',
  'prompt too long',
  'input is too long',
  'request too large'
];

const TRANSIENT_MESSAGE_PATTERNS = [
  'rate limit',
  'rate_limit',
  'too many requests',
  'timeout',
  'timed out',
  'unavailable',
  'overloaded',
  'temporarily',
  'connection error',
  'network error',
  'socket hang up',
  'econnreset',
  'etimedout'
];

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function getHttpStatus(error: unknown): number | undefined {
  if (error === null || typeof error !== 'object' || !('status' in error)) {
    return undefined;
  }
  const status = (error as { status: unknown }).status;
  return typeof status === 'number' ? status : undefined;
}

function getNetworkCode(error: unknown): string | undefined {
  if (!(error instanceof Error) || !('code' in error)) {
    return undefined;
  }
  const code = (error as NodeJS.ErrnoException).code;
  return typeof code === 'string' ? code : undefined;
}

function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.name === 'APIUserAbortError') {
      return true;
    }
  }
  return errorMessage(error).toLowerCase().includes('aborted');
}

function isContextFailFast(messageLower: string): boolean {
  return CONTEXT_FAIL_FAST_PATTERNS.some((pattern) => messageLower.includes(pattern));
}

function isTransientMessage(messageLower: string): boolean {
  return TRANSIENT_MESSAGE_PATTERNS.some((pattern) => messageLower.includes(pattern));
}

/** 将 LLM 调用错误分类，供重试决策使用 */
export function classifyLlmError(error: unknown): LlmErrorKind {
  if (isAbortError(error)) {
    return 'abort';
  }

  const messageLower = errorMessage(error).toLowerCase();
  if (isContextFailFast(messageLower)) {
    return 'fail_fast';
  }

  const status = getHttpStatus(error);
  if (status !== undefined) {
    if (FAIL_FAST_HTTP_STATUSES.has(status)) {
      return 'fail_fast';
    }
    if (TRANSIENT_HTTP_STATUSES.has(status)) {
      return 'transient';
    }
  }

  const networkCode = getNetworkCode(error);
  if (networkCode !== undefined && TRANSIENT_NETWORK_CODES.has(networkCode)) {
    return 'transient';
  }

  if (isTransientMessage(messageLower)) {
    return 'transient';
  }

  return 'unknown';
}

export function isTransientLlmError(error: unknown): boolean {
  return classifyLlmError(error) === 'transient';
}

export interface WithLlmRetryOptions {
  label?: string;
  providerName?: string;
  signal?: AbortSignal;
}

/** P1-07：LLM 重试结果元数据 */
export interface LlmRetryOutcome {
  recoveryKind: 'none' | 'backoff';
  retryAttempts: number;
}

export interface WithLlmRetryResult<T> {
  value: T;
  recovery: LlmRetryOutcome;
}

/**
 * LLM 瞬态错误退避重试（P1-02）：最多额外重试 RecoveryConfig.llmMaxRetries 次。
 */
export async function withLlmRetry<T>(
  fn: () => Promise<T>,
  options: WithLlmRetryOptions = {}
): Promise<WithLlmRetryResult<T>> {
  const maxAttempts = RecoveryConfig.llmMaxRetries + 1;
  const { label = 'llm', providerName = '', signal } = options;
  const prefix = providerName ? `[${providerName}] ` : '';

  let lastError: unknown;
  let retryAttempts = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      retryAttempts = attempt;
      const delayMs = RecoveryConfig.llmRetryDelaysMs[attempt - 1]
        ?? RecoveryConfig.llmRetryDelaysMs[RecoveryConfig.llmRetryDelaysMs.length - 1]
        ?? 0;
      Logger.warn(
        'OPENAI',
        `${prefix}${label}: 瞬态错误，${delayMs}ms 后第 ${attempt}/${RecoveryConfig.llmMaxRetries} 次重试`
      );
      await sleep(delayMs, signal);
    }

    try {
      const value = await fn();
      return {
        value,
        recovery: {
          recoveryKind: retryAttempts > 0 ? 'backoff' : 'none',
          retryAttempts
        }
      };
    } catch (error) {
      lastError = error;
      const kind = classifyLlmError(error);

      if (kind === 'abort') {
        throw error;
      }

      const isLastAttempt = attempt >= maxAttempts - 1;
      if (kind !== 'transient' || isLastAttempt) {
        throw error;
      }

      Logger.warn(
        'OPENAI',
        `${prefix}${label}: 瞬态 LLM 错误 (${kind}): ${errorMessage(error)}`
      );
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
