import { isAbsolute, join, relative, resolve } from 'node:path';

/**
 * 将用户输入解析为 baseDir 内的绝对路径；拒绝目录逃逸。
 * @throws 路径非法或越界时抛出 Error
 */
export function resolveUnderDir(baseDir: string, inputPath: string): string {
  const base = resolve(baseDir);
  const trimmed = inputPath.trim();
  if (!trimmed) {
    throw new Error('path 不能为空');
  }

  let candidate: string;
  if (isAbsolute(trimmed)) {
    candidate = resolve(trimmed);
  } else if (!trimmed.includes('/') && !trimmed.includes('\\')) {
    const fileName = trimmed.endsWith('.txt')
      ? trimmed.replace(/[^a-zA-Z0-9_.-]/g, '_')
      : `${trimmed.replace(/[^a-zA-Z0-9_-]/g, '_') || 'unknown'}.txt`;
    candidate = resolve(base, fileName);
  } else {
    candidate = resolve(base, trimmed);
  }

  const rel = relative(base, candidate);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`路径不允许访问 agentOutputsDir 之外: ${inputPath}`);
  }

  return candidate;
}

/** agentOutputsDir 绝对路径 */
export function resolveAgentOutputsDir(cwd: string, relativeDir: string): string {
  return resolve(cwd, relativeDir);
}
