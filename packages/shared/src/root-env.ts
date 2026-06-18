import nextEnv from '@next/env';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

/** 从任意子目录向上查找含 pnpm-workspace.yaml 的 monorepo 根。 */
export function findMonorepoRoot(fromDir: string): string {
  let dir = fromDir;
  for (;;) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    const parent = resolve(dir, '..');
    if (parent === dir) {
      throw new Error('Monorepo root not found (pnpm-workspace.yaml)');
    }
    dir = parent;
  }
}

/** 将 `file:./packages/...` 解析为相对 monorepo 根的绝对路径（跨 apps/* cwd 一致）。 */
export function resolveDatabaseUrl(url: string, monorepoRoot: string): string {
  if (!url.startsWith('file:')) {
    return url;
  }
  const pathPart = url.slice('file:'.length);
  if (isAbsolute(pathPart)) {
    return url;
  }
  return `file:${resolve(monorepoRoot, pathPart)}`;
}

/** 读取并解析 DATABASE_URL（不加载 .env，仅规范化已注入的 process.env）。 */
export function getResolvedDatabaseUrl(anchorDir: string = process.cwd()): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error('DATABASE_URL is not set');
  }
  const root = findMonorepoRoot(anchorDir);
  return resolveDatabaseUrl(raw, root);
}

let rootEnvLoaded = false;

/**
 * 从 monorepo 根目录加载 .env*（官方 @next/env）。
 * Next 在 next.config 调用；Worker 用 `node --env-file=../../.env` 即可。
 */
export function loadRootEnv(fromDir: string = process.cwd()): void {
  if (rootEnvLoaded) {
    return;
  }
  const root = findMonorepoRoot(fromDir);
  nextEnv.loadEnvConfig(root, undefined, undefined, true);
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    process.env.DATABASE_URL = resolveDatabaseUrl(databaseUrl, root);
  }
  rootEnvLoaded = true;
}
