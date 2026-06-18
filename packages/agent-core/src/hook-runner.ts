import { Logger } from './lib/logger.js';

/** s08 教学版统一退出码 */export type HookExitCode = 0 | 1 | 2;

export type HookEventName = 'SessionStart' | 'SessionEnd' | 'PreToolUse' | 'PostToolUse';

export interface HookResult {
  exit_code: HookExitCode;
  message: string;
}

export type HookHandler = (payload: Record<string, unknown>) => HookResult | Promise<HookResult>;

const HOOKS: Record<HookEventName, HookHandler[]> = {
  SessionStart: [],
  SessionEnd: [],
  PreToolUse: [],
  PostToolUse: []
};

let initialized = false;

export function registerHook(eventName: HookEventName, handler: HookHandler): void {
  HOOKS[eventName].push(handler);
}

export function getHookRegistry(): Readonly<Record<HookEventName, readonly HookHandler[]>> {
  return HOOKS;
}

export async function ensureHooksInitialized(): Promise<void> {
  if (initialized) {
    return;
  }
  const [{ registerBuiltinHooks }, { loadExternalHooks }] = await Promise.all([
    import('./hook-builtin.js'),
    import('./hook-config-loader.js')
  ]);
  registerBuiltinHooks();
  await loadExternalHooks();
  initialized = true;
}

const DEFAULT_RESULT: HookResult = { exit_code: 0, message: '' };

/**
 * 按注册顺序运行 hook；首个 exit_code 1|2 立即返回（s08 教学版语义）。
 */
export async function runHooks(
  eventName: HookEventName,
  payload: Record<string, unknown>
): Promise<HookResult> {
  await ensureHooksInitialized();

  for (const handler of HOOKS[eventName]) {
    try {
      const result = await handler(payload);
      if (result.exit_code === 1 || result.exit_code === 2) {
        return result;
      }
    } catch (error) {
      Logger.error(
        'HOOK',
        `Hook ${eventName} handler failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return DEFAULT_RESULT;
}
