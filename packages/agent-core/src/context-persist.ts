import { mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { ContextConfig } from './config/feature-config.js';
import { Logger } from './lib/logger.js';
import { READ_PERSISTED_OUTPUT_CODE_NAME } from './system-tools/read-persisted-output.js';
import { TOOL_OUTPUT_ARTIFACT_TYPE, ToolOutputArtifact } from './types.js';

export type { ToolOutputArtifact } from './types.js';
export interface MaterializeToolOutputOptions {
  /** 本轮是否向模型暴露 read_persisted_output */
  readBackEnabled?: boolean;
}

export interface MaterializedToolOutput {
  content: string;
  artifact?: ToolOutputArtifact;
}

function buildArtifactRecord(
  toolCallId: string,
  bytes: number,
  filePath: string
): ToolOutputArtifact {
  return {
    type: TOOL_OUTPUT_ARTIFACT_TYPE,
    toolCallId,
    bytes,
    filePath,
    createdAt: new Date().toISOString()
  };
}

function buildArtifactModelView(artifact: ToolOutputArtifact, readBackEnabled: boolean): string {
  const base = {
    type: TOOL_OUTPUT_ARTIFACT_TYPE,
    toolCallId: artifact.toolCallId,
    bytes: artifact.bytes
  };
  if (readBackEnabled) {
    return JSON.stringify({
      ...base,
      readTool: READ_PERSISTED_OUTPUT_CODE_NAME,
      path: artifact.toolCallId
    });
  }
  return JSON.stringify({
    ...base,
    readBackAvailable: false,
    note: '大结果已落盘；读回工具未启用，仅保留摘要。'
  });
}

const MS_PER_DAY = 86_400_000;
/** persist 路径上触发清理的最小间隔（毫秒） */
const AGENT_OUTPUTS_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
let lastAgentOutputsCleanupAt = 0;

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}

export interface CleanupExpiredAgentOutputsResult {
  scanned: number;
  deleted: number;
}

/**
 * 删除 agentOutputsDir 中超过 TTL 的 .txt 落盘文件（P1-01  artifact 生命周期）
 */
export async function cleanupExpiredAgentOutputs(
  cwd: string = process.cwd()
): Promise<CleanupExpiredAgentOutputsResult> {
  const ttlDays = ContextConfig.agentOutputsTtlDays;
  if (ttlDays <= 0) {
    return { scanned: 0, deleted: 0 };
  }

  const dir = join(cwd, ContextConfig.agentOutputsDir);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return { scanned: 0, deleted: 0 };
    }
    throw error;
  }

  const cutoffMs = Date.now() - ttlDays * MS_PER_DAY;
  let deleted = 0;

  for (const name of entries) {
    if (!name.endsWith('.txt')) {
      continue;
    }
    const filePath = join(dir, name);
    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        continue;
      }
      if (fileStat.mtimeMs < cutoffMs) {
        await unlink(filePath);
        deleted++;
      }
    } catch (error) {
      if (isFileNotFoundError(error)) {
        continue;
      }
      Logger.warn('CONTEXT', `清理落盘文件失败 ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (deleted > 0) {
    Logger.info('CONTEXT', `已清理 ${deleted} 个过期落盘文件（TTL ${ttlDays} 天）`);
  }

  return { scanned: entries.length, deleted };
}

async function maybeCleanupExpiredAgentOutputs(): Promise<void> {
  const now = Date.now();
  if (now - lastAgentOutputsCleanupAt < AGENT_OUTPUTS_CLEANUP_INTERVAL_MS) {
    return;
  }
  lastAgentOutputsCleanupAt = now;
  await cleanupExpiredAgentOutputs();
}

/**
 * 超大 tool 输出：落盘 + Artifact stub（P1-01-12）
 */
export async function materializeToolOutput(
  toolUseId: string,
  output: string,
  options: MaterializeToolOutputOptions = {}
): Promise<MaterializedToolOutput> {
  const readBackEnabled = options.readBackEnabled ?? true;
  if (output.length <= ContextConfig.persistThresholdChars) {
    return { content: output };
  }

  await maybeCleanupExpiredAgentOutputs();

  const safeId = toolUseId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'unknown';
  const dir = join(process.cwd(), ContextConfig.agentOutputsDir);
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${safeId}.txt`);
  await writeFile(filePath, output, 'utf8');

  const artifact = buildArtifactRecord(toolUseId, output.length, filePath);
  return {
    content: buildArtifactModelView(artifact, readBackEnabled),
    artifact
  };
}
