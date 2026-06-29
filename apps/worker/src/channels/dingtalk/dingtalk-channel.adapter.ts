import type { ChunkResponse } from '@meek/agent-core';
import { Logger } from '@meek/shared/logger';
import type {
  AgentOutboundEnvelope,
  DingtalkChannelMetaSerialized,
  DoneOutboundPayload,
  ErrorOutboundPayload,
} from '@meek/message-bus';

import type { ChannelAdapter } from '../types.js';
import { formatDingtalkMarkdownOutbound } from './format-dingtalk-markdown-outbound.js';

interface DingtalkReplyContext {
  meta: DingtalkChannelMetaSerialized;
  textParts: string[];
}

function appendChunkText(parts: string[], chunk: ChunkResponse): void {
  if (typeof chunk.content === 'string' && chunk.content.length > 0) {
    parts.push(chunk.content);
  }
}

function isSessionWebhookExpired(expiredTime: number): boolean {
  return Date.now() >= expiredTime;
}

export class DingtalkChannelAdapter implements ChannelAdapter {
  readonly channel = 'dingtalk' as const;

  private readonly replyContexts = new Map<string, DingtalkReplyContext>();

  registerSink(_requestId: string, _sink: unknown): void {
    // 钉钉不经 Web OutboundSink
  }

  unregisterSink(_requestId: string): void {
    // 钉钉不经 Web OutboundSink
  }

  /** Worker 开始处理 job 时注册 reply 上下文 */
  beginReply(requestId: string, meta: DingtalkChannelMetaSerialized): void {
    this.replyContexts.set(requestId, { meta, textParts: [] });
  }

  /** Worker 结束后清理上下文 */
  endReply(requestId: string): void {
    this.replyContexts.delete(requestId);
  }

  sendOutbound(envelope: AgentOutboundEnvelope): void {
    if (envelope.channel !== 'dingtalk') {
      return;
    }

    const context = this.replyContexts.get(envelope.requestId);
    if (!context) {
      Logger.warn('DINGTALK', `出站缺少 reply 上下文 requestId=${envelope.requestId}`);
      return;
    }

    switch (envelope.kind) {
      case 'chunk': {
        appendChunkText(context.textParts, envelope.payload as ChunkResponse);
        break;
      }
      case 'context_compacted':
      case 'usage':
        break;
      case 'done': {
        const payload = envelope.payload as DoneOutboundPayload;
        void this.sendMarkdownReply(context, payload.finish_reason);
        break;
      }
      case 'error': {
        const payload = envelope.payload as ErrorOutboundPayload;
        void this.sendMarkdownReply(context, undefined, payload.error);
        break;
      }
      default: {
        const _exhaustive: never = envelope.kind;
        return _exhaustive;
      }
    }
  }

  private async sendMarkdownReply(
    context: DingtalkReplyContext,
    finishReason?: string,
    errorMessage?: string
  ): Promise<void> {
    const { meta } = context;
    let text = context.textParts.join('').trim();

    if (errorMessage) {
      text = `**处理失败：** ${errorMessage}`;
    } else if (text.length === 0) {
      text = finishReason ? `（无文本输出，finish_reason=${finishReason}）` : '（无文本输出）';
    }

    if (isSessionWebhookExpired(meta.sessionWebhookExpiredTime)) {
      Logger.error(
        'DINGTALK',
        `sessionWebhook 已过期 msgId=${meta.msgId} conversationId=${meta.conversationId}`
      );
      return;
    }

    const { title, text: markdownText } = formatDingtalkMarkdownOutbound(text);

    try {
      const response = await fetch(meta.sessionWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'markdown',
          markdown: {
            title,
            text: markdownText,
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      Logger.info(
        'DINGTALK',
        `sessionWebhook markdown 回复 conversationId=${meta.conversationId} msgId=${meta.msgId} title=${title}`
      );
    } catch (error: unknown) {
      Logger.error(
        'DINGTALK',
        `sessionWebhook 回复失败 msgId=${meta.msgId} conversationId=${meta.conversationId}`,
        error
      );
    }
  }
}

let dingtalkChannelAdapter: DingtalkChannelAdapter | null = null;

export function getDingtalkChannelAdapter(): DingtalkChannelAdapter {
  dingtalkChannelAdapter ??= new DingtalkChannelAdapter();
  return dingtalkChannelAdapter;
}
