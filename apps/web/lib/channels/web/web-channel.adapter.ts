import type { ChunkResponse } from '@meek/agent-core';
import type {
  AgentOutboundEnvelope,
  ContextCompactedPayload,
  DoneOutboundPayload,
  ErrorOutboundPayload,
  UsageOutboundPayload,
} from '@meek/message-bus';

export interface WebSseSink {
  writeRaw: (raw: string) => void;
  end: () => void;
  isEnded: () => boolean;
  abortController: AbortController;
  clearKeepAlive?: () => void;
}

const sinks = new Map<string, WebSseSink>();

export function registerOutboundSink(requestId: string, sink: WebSseSink): void {
  sinks.set(requestId, sink);
}

export function getOutboundSink(requestId: string): WebSseSink | undefined {
  return sinks.get(requestId);
}

export function unregisterOutboundSink(requestId: string): void {
  sinks.delete(requestId);
}

export function sendOutboundToSink(envelope: AgentOutboundEnvelope): void {
  if (envelope.channel !== 'web') {
    return;
  }

  const sink = getOutboundSink(envelope.requestId);
  if (!sink || sink.isEnded()) {
    return;
  }

  switch (envelope.kind) {
    case 'chunk': {
      const chunk = envelope.payload as ChunkResponse;
      sink.writeRaw(
        `data: ${JSON.stringify({ ...chunk, requestId: envelope.requestId })}\n\n`
      );
      break;
    }
    case 'context_compacted': {
      const payload = envelope.payload as ContextCompactedPayload;
      sink.writeRaw(`event: context_compacted\ndata: ${JSON.stringify(payload)}\n\n`);
      break;
    }
    case 'usage': {
      const payload = envelope.payload as UsageOutboundPayload;
      sink.writeRaw(`event: usage\ndata: ${JSON.stringify(payload)}\n\n`);
      break;
    }
    case 'done': {
      sink.clearKeepAlive?.();
      const payload = envelope.payload as DoneOutboundPayload;
      sink.writeRaw(`event: done\ndata: ${JSON.stringify(payload)}\n\n`);
      sink.end();
      break;
    }
    case 'error': {
      sink.clearKeepAlive?.();
      const payload = envelope.payload as ErrorOutboundPayload;
      sink.writeRaw(`event: error\ndata: ${JSON.stringify(payload)}\n\n`);
      sink.end();
      break;
    }
    default: {
      const _exhaustive: never = envelope.kind;
      return _exhaustive;
    }
  }
}

export function getWebChannelAdapter(): {
  registerSink: typeof registerOutboundSink;
  unregisterSink: typeof unregisterOutboundSink;
  sendOutbound: typeof sendOutboundToSink;
} {
  return {
    registerSink: registerOutboundSink,
    unregisterSink: unregisterOutboundSink,
    sendOutbound: sendOutboundToSink,
  };
}
