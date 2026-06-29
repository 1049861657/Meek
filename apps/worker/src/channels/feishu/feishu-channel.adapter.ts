import type { ChunkResponse } from '@meek/agent-core';
import { Logger } from '@meek/shared/logger';
import type {
  AgentOutboundEnvelope,
  DoneOutboundPayload,
  ErrorOutboundPayload,
} from '@meek/message-bus';

import type { ChannelAdapter } from '../types.js';
import { getFeishuClient } from './feishu-sdk.js';

interface FeishuReplyContext {
  messageId: string;
  chatId: string;
  textParts: string[];
}

function appendChunkText(parts: string[], chunk: ChunkResponse): void {
  if (typeof chunk.content === 'string' && chunk.content.length > 0) {
    parts.push(chunk.content);
  }
}

export class FeishuChannelAdapter implements ChannelAdapter {
  readonly channel = 'feishu' as const;

  private readonly replyContexts = new Map<string, FeishuReplyContext>();

  registerSink(_requestId: string, _sink: unknown): void {
    // 飞书不经 Web OutboundSink
  }

  unregisterSink(_requestId: string): void {
    // 飞书不经 Web OutboundSink
  }

  beginReply(requestId: string, messageId: string, chatId: string): void {
    this.replyContexts.set(requestId, { messageId, chatId, textParts: [] });
  }

  endReply(requestId: string): void {
    this.replyContexts.delete(requestId);
  }

  sendOutbound(envelope: AgentOutboundEnvelope): void {
    if (envelope.channel !== 'feishu') {
      return;
    }

    const context = this.replyContexts.get(envelope.requestId);
    if (!context) {
      Logger.warn('FEISHU', `出站缺少 reply 上下文 requestId=${envelope.requestId}`);
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
        void this.sendTextReply(context, payload.finish_reason);
        break;
      }
      case 'error': {
        const payload = envelope.payload as ErrorOutboundPayload;
        void this.sendTextReply(context, undefined, payload.error);
        break;
      }
      default: {
        const _exhaustive: never = envelope.kind;
        return _exhaustive;
      }
    }
  }

  private async sendTextReply(
    context: FeishuReplyContext,
    finishReason?: string,
    errorMessage?: string
  ): Promise<void> {
    const { messageId } = context;
    let text = context.textParts.join('').trim();

    if (errorMessage) {
      text = `处理失败：${errorMessage}`;
    } else if (text.length === 0) {
      text = finishReason ? `（无文本输出，finish_reason=${finishReason}）` : '（无文本输出）';
    }

    try {
      const client = getFeishuClient();
      await client.im.v1.message.reply({
        path: { message_id: messageId },
        data: {
          msg_type: 'text',
          content: JSON.stringify({ text }),
        },
      });
      Logger.info('FEISHU', `message.reply chatId=${context.chatId} messageId=${messageId}`);
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : String(error);
      Logger.error('FEISHU', `message.reply 失败 messageId=${messageId}`, error);
      throw new Error(errMessage);
    }
  }
}

let feishuChannelAdapter: FeishuChannelAdapter | null = null;

export function getFeishuChannelAdapter(): FeishuChannelAdapter {
  feishuChannelAdapter ??= new FeishuChannelAdapter();
  return feishuChannelAdapter;
}
