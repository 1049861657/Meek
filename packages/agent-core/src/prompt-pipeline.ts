import { getMcpClientForUser } from './ports/mcp-client-port.js';
import { resolveMcpPoolKey } from './lib/mcp-pool-key.js';
import { getSetting } from './ports/settings-port.js';
import { ToolPolicyService } from './services/tool-policy.service.js';
import type { ResolvedProfile } from '@meek/shared';
import { buildEnabledToolsSchemaSummary } from './lib/tool-schema-summary.js';
import {
  logMemoryRecallSkipped,
  recallForPrompt
} from './ports/memory-port.js';
import { isHindsightMemoryConfigured } from './config/feature-config.js';
import type { MemoryPipelineContext } from './memory-pipeline-context.js';
import type { InternalMessage } from './types.js';

export const PROMPT_SECTION_ORDER = [
  'core',
  'tools',
  'skills_catalog',
  'memory',
  'project_rules'
] as const;

export type PromptSectionKey = (typeof PROMPT_SECTION_ORDER)[number];

export interface PromptPipelineOptions {
  enableTools: boolean;
  enablePrompts: boolean;
  resolvedProfile?: ResolvedProfile;
  /** 预览 API：覆盖 mcpToolPrompt / Profile.toolPrompt（仅影响分段展示，不改变实际发送） */
  toolPromptOverride?: string;
  /** 设置页提示词预览为 false，不展示、不 recall memory 段 */
  includeMemory?: boolean;
  /** P3-02-B：Hindsight recall 上下文 */
  memoryContext?: MemoryPipelineContext;
  /** 对话日志关联 requestId */
  requestId?: string;
  signal?: AbortSignal;
}

export interface AssembledSystemPreview {
  role: 'system';
  content: string;
  charCount: number;
}

export interface PromptSectionPreview {
  key: PromptSectionKey;
  label: string;
  source: string;
  content: string;
  includedInSystem: boolean;
}

export interface SystemPromptSections {
  core: string;
  tools: string;
  skills_catalog: string;
  memory: string;
  project_rules: string;
}

const SECTION_LABELS: Record<PromptSectionKey, string> = {
  core: '基础提示词',
  tools: '用户提示词',
  skills_catalog: '技能提示词',
  memory: '记忆提示词',
  project_rules: '服务提示词'
};

/** 展开详情时展示的短说明（面向用户，避免技术字段名） */
const SECTION_SOURCES: Record<PromptSectionKey, string> = {
  core: '系统预留，当前通常为空',
  tools: '来自本页编辑框或聊天设置中保存的内容',
  skills_catalog: '后续版本支持',
  memory: '跨会话记忆：长期偏好摘要 + 归纳观察与世界事实',
  project_rules: '来自当前已启用连接服务自带的说明'
};

function joinNonEmpty(parts: string[]): string {
  return parts.filter(p => p.trim().length > 0).join('\n\n');
}

/** 工具关闭时仍允许注入 memory 段（P3-02-B） */
export function shouldAssembleSystemPrompt(options: PromptPipelineOptions): boolean {
  if (options.enableTools) {
    return true;
  }
  const ctx = options.memoryContext;
  return Boolean(ctx && !ctx.skipMemory && isHindsightMemoryConfigured());
}

/**
 * System Prompt 组装流水线（对齐 s10：分段来源；稳定段进 system）
 */
export class SystemPromptBuilder {
  constructor(private readonly options: PromptPipelineOptions) {}

  async buildSections(): Promise<SystemPromptSections> {
    return {
      core: this._buildCore(),
      tools: await this._buildTools(),
      skills_catalog: this._buildSkillsCatalog(),
      memory: await this._buildMemory(),
      project_rules: this._buildProjectRules()
    };
  }

  async buildStableContent(): Promise<string> {
    const s = await this.buildSections();
    return joinNonEmpty([
      s.core,
      s.tools,
      s.skills_catalog,
      s.memory,
      s.project_rules
    ]);
  }

  async buildSectionPreviews(): Promise<PromptSectionPreview[]> {
    const assembled = await this.buildSections();
    const userPrompt = await this.resolveUserToolPrompt();
    const display: SystemPromptSections = {
      ...assembled,
      tools: userPrompt
    };

    const sectionOrder =
      this.options.includeMemory === false
        ? PROMPT_SECTION_ORDER.filter((key) => key !== 'memory')
        : PROMPT_SECTION_ORDER;

    return sectionOrder.map(key => {
      const content = display[key];
      const includedInSystem = this.isSectionIncludedInSystem(key, content);
      const source =
        key === 'tools' && !includedInSystem && content.trim()
          ? '提示词开关关闭，不会发给模型'
          : SECTION_SOURCES[key];
      return {
        key,
        label: SECTION_LABELS[key],
        source,
        content,
        includedInSystem
      };
    });
  }

  private isSectionIncludedInSystem(
    key: PromptSectionKey,
    content: string
  ): boolean {
    if (!content.trim()) {
      return false;
    }
    // memory 段：有 recall 内容即注入 system，不依赖 enableTools / enablePrompts
    if (key === 'memory') {
      return true;
    }
    if (!this.options.enableTools) {
      return false;
    }
    if (key === 'tools') {
      return this.options.enablePrompts;
    }
    if (key === 'project_rules') {
      return true;
    }
    return false;
  }

  private _buildCore(): string {
    return '';
  }

  /** 用户提示词正文（与是否注入 system 无关，供分段预览） */
  private async resolveUserToolPrompt(): Promise<string> {
    if (!this.options.enableTools) {
      return '';
    }
    if (this.options.toolPromptOverride !== undefined) {
      return this.options.toolPromptOverride.trim();
    }
    if (this.options.resolvedProfile) {
      return this.options.resolvedProfile.toolPrompt.trim();
    }
    const raw = await getSetting('mcpToolPrompt');
    return String(raw ?? '').trim();
  }

  private async _buildTools(): Promise<string> {
    if (!this.options.enableTools || !this.options.enablePrompts) {
      return '';
    }
    const userPrompt = await this.resolveUserToolPrompt();
    const catalog = await this._buildEnabledToolsSchemaSummary();
    return joinNonEmpty([userPrompt, catalog]);
  }

  private async _buildEnabledToolsSchemaSummary(): Promise<string> {
    const serverIds = this.options.resolvedProfile?.mcpServerIds;
    if (!serverIds?.length) {
      return '';
    }
    const poolKey = resolveMcpPoolKey(this.options.resolvedProfile);
    const enabledTools = await ToolPolicyService.collectEnabledToolsForServerIds(
      serverIds,
      poolKey
    );
    return buildEnabledToolsSchemaSummary(enabledTools);
  }

  private _buildSkillsCatalog(): string {
    return '';
  }

  /**
   * P3-02-B：会话开始时从 Hindsight recall 注入跨会话记忆。
   * 冲突规则：任务进度与目录结构以当前工具观察为准（见 MEMORY_SECTION_PREFIX）。
   */
  private async _buildMemory(): Promise<string> {
    if (this.options.includeMemory === false) {
      return '';
    }
    const ctx = this.options.memoryContext;
    if (!ctx) {
      return '';
    }
    if (ctx.skipMemory) {
      logMemoryRecallSkipped(this.options.requestId, {
        bankId: ctx.bankId,
        query: ctx.query,
        reason: 'skipMemory'
      });
      return '';
    }
    if (!isHindsightMemoryConfigured()) {
      return '';
    }
    return recallForPrompt(ctx.bankId, ctx.query, {
      signal: this.options.signal,
      requestId: this.options.requestId
    });
  }

  private _buildProjectRules(): string {
    if (!this.options.enableTools) {
      return '';
    }
    return getMcpClientForUser(resolveMcpPoolKey(this.options.resolvedProfile))
      .getInstructions(this.options.resolvedProfile?.mcpServerIds)
      .trim();
  }
}

/**
 * 将稳定段写入 system；已有 system 或 `_source: reminder` 的用户消息不并入 system
 */
export async function applyPromptPipelineToMessages(
  messages: InternalMessage[],
  options: PromptPipelineOptions
): Promise<InternalMessage[]> {
  const result: InternalMessage[] = [...messages];

  if (!shouldAssembleSystemPrompt(options)) {
    return result;
  }

  const hasSystemMessage = result.some(
    m => m.role === 'system' && m._source !== 'reminder'
  );
  if (hasSystemMessage) {
    return result;
  }

  const builder = new SystemPromptBuilder(options);
  const stable = await builder.buildStableContent();
  if (stable.trim()) {
    result.unshift({
      role: 'system',
      content: stable,
      _source: 'system'
    });
  }

  return result;
}

export async function buildSystemPromptSectionPreviews(
  options: PromptPipelineOptions
): Promise<PromptSectionPreview[]> {
  const builder = new SystemPromptBuilder(options);
  return builder.buildSectionPreviews();
}

/** 与 `applyPromptPipelineToMessages` 注入的 system 正文一致 */
export async function buildAssembledSystemPreview(
  options: PromptPipelineOptions
): Promise<AssembledSystemPreview | null> {
  if (!shouldAssembleSystemPrompt(options)) {
    return null;
  }
  const builder = new SystemPromptBuilder(options);
  const content = await builder.buildStableContent();
  if (!content.trim()) {
    return null;
  }
  return {
    role: 'system',
    content,
    charCount: content.length
  };
}
