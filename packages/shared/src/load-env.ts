import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** 自 cwd 向上查找含 pnpm-workspace.yaml 的 monorepo 根目录 */
export function findMonorepoRoot(fromDir: string = process.cwd()): string {
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

/** 加载仓库根目录 .env（Turbo 子包 cwd 非根时仍需显式调用） */
export function loadRootEnv(fromDir?: string): void {
  const root = findMonorepoRoot(fromDir);
  config({ path: resolve(root, '.env') });
}
