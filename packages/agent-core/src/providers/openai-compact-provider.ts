import { OpenAI as OpenAIClient } from 'openai';

import { resolveCompactModel, resolveSummarizeMaxTokens } from '../config/feature-config.js';
import { compactHistory, type CompactSummarizeResult } from '../context-compact.js';
import { Logger } from '../lib/logger.js';
import type { InternalMessage } from '../types.js';
import type { AIProvider } from './provider-types.js';

/**
 * Web BFF 专用：仅 OpenAI 兼容调用 + 消息压缩，不依赖 Harness / MCP / 落盘。
 */
export class OpenAiCompactProvider {
  public readonly providerName: string;
  private readonly config: AIProvider;
  private readonly client: OpenAIClient;

  constructor(providerConfig: AIProvider) {
    this.config = providerConfig;
    this.providerName = providerConfig.name;
    this.client = new OpenAIClient({
      apiKey: this.config.apiKey,
      baseURL: this.config.apiUrl,
    });
    Logger.info('OPENAI', `BFF compact provider: ${this.providerName}`);
  }

  async compactMessages(
    messages: InternalMessage[],
    compactModel?: string,
    signal?: AbortSignal
  ): Promise<InternalMessage[]> {
    const summarizeModel = resolveCompactModel(compactModel, this.config.defaultModel);
    return compactHistory(messages, async (serialized) =>
      this.summarizeForCompact(serialized, summarizeModel, signal)
    );
  }

  private async summarizeForCompact(
    serialized: string,
    model: string,
    signal?: AbortSignal
  ): Promise<CompactSummarizeResult> {
    const maxTokens = resolveSummarizeMaxTokens(serialized.length);
    const response = await this.client.chat.completions.create(
      {
        model,
        messages: [{ role: 'user', content: serialized }],
        max_tokens: maxTokens,
        temperature: 0.3,
      },
      { signal }
    );
    const choice = response.choices[0];
    const finishReason = choice?.finish_reason ?? null;
    const content = choice?.message?.content;
    if (typeof content === 'string' && content.length > 0) {
      return { text: content, finishReason };
    }
    return { text: '（摘要生成失败）', finishReason };
  }
}
