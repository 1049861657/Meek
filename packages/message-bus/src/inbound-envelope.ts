import type {
  AgentMessageEnvelope,
  AgentMessageEnvelopeSerialized,
  WebAgentMessageEnvelope,
} from './channel.types.js';
import { parseAgentMessageEnvelopeSerialized } from './channel.schema.js';

function serializeWebInbound(envelope: WebAgentMessageEnvelope): AgentMessageEnvelopeSerialized {
  const { requestId, vendor, webChatSessionId, userId } = envelope.channelMeta;
  const channelMeta: AgentMessageEnvelopeSerialized['channelMeta'] = {
    requestId,
    webChatSessionId,
  };
  if (vendor !== undefined) {
    channelMeta.vendor = vendor;
  }
  if (userId !== undefined) {
    channelMeta.userId = userId;
  }
  return {
    id: envelope.id,
    source: envelope.source,
    type: envelope.type,
    time: envelope.time,
    channel: envelope.channel,
    sessionKey: envelope.sessionKey,
    channelMeta,
    payload: envelope.payload,
    trace: envelope.trace,
  };
}

export function serializeInboundEnvelope(
  envelope: AgentMessageEnvelope
): AgentMessageEnvelopeSerialized {
  if (envelope.channel !== 'web') {
    throw new Error(`serializeInboundEnvelope: 暂不支持 channel=${envelope.channel}`);
  }
  return serializeWebInbound(envelope);
}

export function prepareSerializedInbound(
  envelope: AgentMessageEnvelope
): AgentMessageEnvelopeSerialized {
  const serialized = serializeInboundEnvelope(envelope);
  return parseAgentMessageEnvelopeSerialized(serialized);
}
