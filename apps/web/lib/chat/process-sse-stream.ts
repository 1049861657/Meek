import { parseSseDataPayload } from './sse-parse';
import { applyStreamChunk } from './apply-stream-chunk';
import type { AssistantMessage } from './chat-ui-types';

export interface StreamRuntime {
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  userAborted: boolean;
}

export interface SseStreamCallbacks {
  onBegin: (requestId: string) => void;
  onAssistantUpdate: (updater: (prev: AssistantMessage) => AssistantMessage) => void;
  onContextCompacted: () => void;
  onUsage: (elapsedSeconds?: number) => void;
  onStreamError: (message: string) => void;
  onDone: () => void;
}

export interface ConsumeSseStreamResult {
  fullText: string;
  aborted: boolean;
  readError: string | null;
}

/**
 * 消费 POST /api/chat/stream 响应 — 移植 stream-handler processStreamResponse
 */
export async function consumeSseStream(
  response: Response,
  assistantId: string,
  runtime: StreamRuntime,
  callbacks: SseStreamCallbacks
): Promise<ConsumeSseStreamResult> {
  const body = response.body;
  if (!body) {
    throw new Error('响应无 body 流');
  }

  const reader = body.getReader();
  runtime.reader = reader;
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let eventName = '';
  let buffer = '';
  let readError: string | null = null;

  const applyPayloads = (payloads: Record<string, unknown>[]): void => {
    callbacks.onAssistantUpdate((prev) => {
      let next = prev;
      for (const payload of payloads) {
        next = applyStreamChunk(next, payload);
      }
      fullText = next.content;
      return next;
    });
  };

  const handleEventData = async (name: string, eventData: string): Promise<void> => {
    if (name === 'begin' && eventData) {
      try {
        const beginData = JSON.parse(eventData) as { requestId?: string };
        if (beginData.requestId) {
          callbacks.onBegin(beginData.requestId);
        }
      } catch {
        console.warn('[SSE] 解析 begin 事件失败');
      }
      return;
    }

    if (name === 'context_compacted') {
      callbacks.onContextCompacted();
      callbacks.onAssistantUpdate((prev) => ({ ...prev, contextCompacted: true }));
      return;
    }

    if (name === 'error' && eventData) {
      try {
        const errPayload = JSON.parse(eventData) as { error?: string };
        const msg = errPayload.error ?? '未知错误';
        callbacks.onStreamError(msg);
        callbacks.onAssistantUpdate((prev) => ({
          ...prev,
          content: `错误: ${msg}`,
          isError: true,
          isStreaming: false,
        }));
      } catch {
        console.warn('[SSE] 解析 error 事件失败');
      }
      return;
    }

    if (name === 'usage' && eventData) {
      try {
        const usageData = JSON.parse(eventData) as { elapsedTime?: number };
        callbacks.onUsage(usageData.elapsedTime);
        if (typeof usageData.elapsedTime === 'number') {
          callbacks.onAssistantUpdate((prev) => ({
            ...prev,
            elapsedSeconds: usageData.elapsedTime,
          }));
        }
      } catch {
        console.error('[SSE] 解析 usage 失败');
      }
      return;
    }

    if (name === 'done') {
      callbacks.onDone();
      callbacks.onAssistantUpdate((prev) => ({
        ...prev,
        isStreaming: false,
      }));
      return;
    }

    if (!eventData) {
      return;
    }

    const payloads = parseSseDataPayload(eventData);
    if (!payloads) {
      const looksLikeToolProtocol =
        /"tool_call"/.test(eventData) && eventData.trim().startsWith('{');
      if (looksLikeToolProtocol) {
        console.warn('[SSE] 工具协议 data 行解析失败，已忽略');
        return;
      }
      fullText += eventData;
      callbacks.onAssistantUpdate((prev) => ({
        ...prev,
        content: prev.content + eventData,
      }));
      return;
    }

    applyPayloads(payloads);
  };

  const processLine = async (line: string): Promise<void> => {
    if (line.startsWith('event:')) {
      eventName = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      await handleEventData(eventName, line.substring(5).trim());
    } else if (!line.trim()) {
      eventName = '';
    }
  };

  try {
    while (true) {
      let done: boolean;
      let value: Uint8Array | undefined;
      try {
        const readResult = await reader.read();
        done = readResult.done;
        value = readResult.value;
      } catch (error: unknown) {
        if (!runtime.userAborted) {
          readError = error instanceof Error ? error.message : String(error);
        }
        break;
      }

      if (done) {
        if (buffer.length > 0) {
          for (const line of `${buffer}\n`.split('\n')) {
            await processLine(line);
          }
          buffer = '';
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      if (lines.length > 1) {
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          await processLine(line);
        }
      }
    }
  } finally {
    runtime.reader = null;
    try {
      reader.releaseLock();
    } catch {
      // already released after cancel
    }
    if (readError) {
      callbacks.onStreamError(readError);
      callbacks.onAssistantUpdate((prev) => ({
        ...prev,
        id: assistantId,
        content: prev.content || `错误: ${readError}`,
        isError: true,
        isStreaming: false,
      }));
    } else if (!runtime.userAborted) {
      callbacks.onAssistantUpdate((prev) => ({
        ...prev,
        isStreaming: false,
      }));
    }
  }

  return {
    fullText,
    aborted: runtime.userAborted,
    readError,
  };
}
