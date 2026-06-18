import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

import { HookConfig } from './config/feature-config.js';
import { Logger } from './lib/logger.js';
import { registerHook, type HookEventName, type HookResult } from './hook-runner.js';

interface ExternalHookDefinition {
  command: string;
  matcher?: string;
  timeout?: number;
}

interface HooksJsonFile {
  version?: number;
  hooks?: Partial<Record<HookEventName, ExternalHookDefinition[]>>;
}

/**
 * 从 `.meek/hooks.json` 或项目根 `hooks.json` 加载外部 command hook。
 * 脚本 stdin 收 JSON payload，stdout 回 `{ "exit_code": 0|1|2, "message": "..." }`。
 */

const HOOK_CONFIG_PATHS = ['.meek/hooks.json', 'hooks.json'] as const;

const VALID_EVENTS: readonly HookEventName[] = [
  'SessionStart',
  'SessionEnd',
  'PreToolUse',
  'PostToolUse'
];

function isHookEventName(value: string): value is HookEventName {
  return (VALID_EVENTS as readonly string[]).includes(value);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function resolveHooksConfigPath(): Promise<string | null> {
  const cwd = process.cwd();
  for (const relativePath of HOOK_CONFIG_PATHS) {
    const absolutePath = join(cwd, relativePath);
    if (await fileExists(absolutePath)) {
      return absolutePath;
    }
  }
  return null;
}

function parseHooksJson(raw: string): HooksJsonFile {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('hooks.json 根节点须为 object');
  }
  return parsed as HooksJsonFile;
}

function matchesHook(matcher: string | undefined, payload: Record<string, unknown>): boolean {
  if (!matcher || matcher.trim().length === 0) {
    return true;
  }
  const codeName = typeof payload.codeName === 'string' ? payload.codeName : '';
  const toolName = typeof payload.toolName === 'string' ? payload.toolName : '';
  const regex = new RegExp(matcher);
  return regex.test(codeName) || regex.test(toolName);
}

function runCommandHook(
  command: string,
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<HookResult> {
  return new Promise((resolve) => {
    const child = spawn(command, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (result: HookResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish({ exit_code: 0, message: '' });
      Logger.warn('HOOK', `External hook timed out: ${command}`);
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (error) => {
      Logger.error('HOOK', `External hook spawn failed (${command}): ${error.message}`);
      finish({ exit_code: 0, message: '' });
    });

    child.on('close', () => {
      if (stderr.trim().length > 0) {
        Logger.warn('HOOK', `External hook stderr (${command}): ${stderr.trim()}`);
      }

      const trimmed = stdout.trim();
      if (trimmed.length === 0) {
        finish({ exit_code: 0, message: '' });
        return;
      }

      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (typeof parsed !== 'object' || parsed === null) {
          throw new Error('stdout 须为 JSON object');
        }
        const obj = parsed as Record<string, unknown>;
        const exitCode = obj.exit_code;
        const message = typeof obj.message === 'string' ? obj.message : '';
        if (exitCode === 0 || exitCode === 1 || exitCode === 2) {
          finish({ exit_code: exitCode, message });
          return;
        }
        throw new Error(`exit_code 须为 0|1|2，收到 ${String(exitCode)}`);
      } catch (error) {
        Logger.error(
          'HOOK',
          `External hook invalid JSON (${command}): ${error instanceof Error ? error.message : String(error)}`
        );
        finish({ exit_code: 0, message: '' });
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

function registerExternalHook(eventName: HookEventName, definition: ExternalHookDefinition): void {
  if (typeof definition.command !== 'string' || definition.command.trim().length === 0) {
    throw new Error(`${eventName} hook 缺少 command`);
  }

  const command = definition.command.trim();
  const timeoutMs = typeof definition.timeout === 'number' && definition.timeout > 0
    ? definition.timeout * 1000
    : HookConfig.externalHookTimeoutMs;

  registerHook(eventName, async (payload) => {
    if (!matchesHook(definition.matcher, payload)) {
      return { exit_code: 0, message: '' };
    }
    return runCommandHook(command, payload, timeoutMs);
  });
}

export async function loadExternalHooks(): Promise<void> {
  const configPath = await resolveHooksConfigPath();
  if (!configPath) {
    return;
  }

  const raw = await readFile(configPath, 'utf8');
  const config = parseHooksJson(raw);

  if (config.hooks === undefined) {
    return;
  }

  for (const [eventName, definitions] of Object.entries(config.hooks)) {
    if (!isHookEventName(eventName)) {
      Logger.warn('HOOK', `hooks.json 忽略未知事件: ${eventName}`);
      continue;
    }
    if (!Array.isArray(definitions)) {
      continue;
    }
    for (const definition of definitions) {
      if (typeof definition !== 'object' || definition === null) {
        continue;
      }
      try {
        registerExternalHook(eventName, definition as ExternalHookDefinition);
        Logger.info('HOOK', `Registered external hook: ${eventName} -> ${(definition as ExternalHookDefinition).command}`);
      } catch (error) {
        Logger.error(
          'HOOK',
          `Failed to register ${eventName} hook: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
}
