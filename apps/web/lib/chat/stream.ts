import {
  publishAbortSignal,
  publishInbound,
  subscribeOutboundEvents,
} from '@meek/message-bus';
import { ToolsConfig } from '@meek/agent-core';

import { getWebChannelAdapter } from '@/lib/channels/web/web-channel.adapter';
import { normalizeWebInbound } from '@/lib/channels/web/normalize-web-inbound';
import { SSE_KEEP_ALIVE_INTERVAL_MS } from '@/lib/channels/web/sse-config';
import { generateRequestId } from '@/lib/ai/request-id';
import { loadAiProvidersConfig } from '@/lib/ai/provider-config';
import { getProviderForUser } from '@meek/agent-core/provider';
import {
  sanitizeWebEnabledSystemToolNames,
  sanitizeWebEnabledToolNames,
  sanitizeWebMcpServerIds,
} from '@/lib/chat/sanitize-web-request';
import type { RequestPrincipal } from '@/lib/chat/resolve-principal';

export async function handleChatStream(
  body: Record<string, unknown>,
  principal: RequestPrincipal
): Promise<Response> {
  const requestId = generateRequestId();
  const webAdapter = getWebChannelAdapter();
  const encoder = new TextEncoder();
  let ended = false;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  let unsubscribeOutbound: (() => void) | null = null;
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const clearKeepAlive = (): void => {
    if (keepAliveTimer !== null) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      streamController = controller;
      const writeRaw = (raw: string): void => {
        if (streamController) {
          controller.enqueue(encoder.encode(raw));
        }
      };
      const end = (): void => {
        ended = true;
        clearKeepAlive();
        unsubscribeOutbound?.();
        webAdapter.unregisterSink(requestId);
        streamController = null;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const abortController = new AbortController();
      writeRaw(`event: begin\ndata: ${JSON.stringify({ requestId })}\n\n`);

      try {
        await loadAiProvidersConfig(principal.configUserId);
        sanitizeWebMcpServerIds(body);
        sanitizeWebEnabledToolNames(body);
        sanitizeWebEnabledSystemToolNames(body);

        const envelope = await normalizeWebInbound({
          body,
          requestId,
          abortSignal: abortController.signal,
          ...(principal.userId ? { userId: principal.userId } : {}),
        });

        const vendor =
          typeof envelope.channelMeta.vendor === 'string'
            ? envelope.channelMeta.vendor
            : undefined;
        const service = await getProviderForUser(principal.configUserId, vendor);
        if (!service) {
          writeRaw(
            `event: error\ndata: ${JSON.stringify({ requestId, error: '无可用 AI 服务，请先配置提供商' })}\n\n`
          );
          end();
          return;
        }

        const { messages, chatOptions = {} } = envelope.payload;
        const toolMessageCount = messages.filter((message) => message.role === 'tool').length;
        console.info(
          `[API] 收到流式聊天请求 requestId=${requestId} messages=${messages.length} ` +
            `tool=${toolMessageCount} vendor=${vendor ?? '默认'} tools=${chatOptions.enableTools ?? ToolsConfig.enableMCPTools} ` +
            `prompts=${chatOptions.enablePrompts} maxToolRounds=${chatOptions.maxToolCallRounds} ` +
            `autoCompact=${chatOptions.enableAutoCompact} skipMemory=${chatOptions.skipMemory === true}`
        );

        webAdapter.registerSink(requestId, {
          writeRaw,
          end,
          isEnded: () => ended,
          abortController,
          clearKeepAlive,
        });

        unsubscribeOutbound = subscribeOutboundEvents(
          requestId,
          (outbound) => {
            webAdapter.sendOutbound(outbound);
          },
          abortController.signal
        );

        await publishInbound(envelope);

        keepAliveTimer = setInterval(() => {
          if (streamController) {
            writeRaw(': keep-alive\n\n');
          }
        }, SSE_KEEP_ALIVE_INTERVAL_MS);
      } catch (error: unknown) {
        clearKeepAlive();
        unsubscribeOutbound?.();
        webAdapter.unregisterSink(requestId);
        const errMessage = error instanceof Error ? error.message : String(error);
        console.error(`[API] publishInbound 失败 requestId=${requestId}:`, error);
        writeRaw(`event: error\ndata: ${JSON.stringify({ requestId, error: errMessage })}\n\n`);
        end();
      }
    },
    cancel() {
      ended = true;
      clearKeepAlive();
      unsubscribeOutbound?.();
      webAdapter.unregisterSink(requestId);
      void publishAbortSignal(requestId);
      streamController = null;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
