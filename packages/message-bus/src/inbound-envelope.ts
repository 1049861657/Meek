import type {
  AgentMessageEnvelope,
  AgentMessageEnvelopeSerialized,
  DingtalkAgentMessageEnvelope,
  FeishuAgentMessageEnvelope,
  WebAgentMessageEnvelope,
  WebChannelMetaSerialized,
} from './channel.types.js';
import { parseAgentMessageEnvelopeSerialized } from './channel.schema.js';

function serializeWebInbound(envelope: WebAgentMessageEnvelope): AgentMessageEnvelopeSerialized {
  const { requestId, vendor, webChatSessionId, userId } = envelope.channelMeta;
  const channelMeta: WebChannelMetaSerialized = { requestId, webChatSessionId };
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

function serializeFeishuInbound(
  envelope: FeishuAgentMessageEnvelope
): AgentMessageEnvelopeSerialized {
  const { requestId, messageId, chatId, vendor } = envelope.channelMeta;
  const channelMeta =
    vendor !== undefined
      ? { requestId, messageId, chatId, vendor }
      : { requestId, messageId, chatId };
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

function serializeDingtalkInbound(
  envelope: DingtalkAgentMessageEnvelope
): AgentMessageEnvelopeSerialized {
  const {
    requestId,
    msgId,
    conversationId,
    sessionWebhook,
    sessionWebhookExpiredTime,
    robotCode,
    conversationType,
    vendor,
  } = envelope.channelMeta;
  const channelMeta: DingtalkAgentMessageEnvelope['channelMeta'] = {
    requestId,
    msgId,
    conversationId,
    sessionWebhook,
    sessionWebhookExpiredTime,
  };
  if (robotCode !== undefined) {
    channelMeta.robotCode = robotCode;
  }
  if (conversationType !== undefined) {
    channelMeta.conversationType = conversationType;
  }
  if (vendor !== undefined) {
    channelMeta.vendor = vendor;
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
  if (envelope.channel === 'web') {
    return serializeWebInbound(envelope);
  }
  if (envelope.channel === 'feishu') {
    return serializeFeishuInbound(envelope);
  }
  return serializeDingtalkInbound(envelope);
}

export function prepareSerializedInbound(
  envelope: AgentMessageEnvelope
): AgentMessageEnvelopeSerialized {
  const serialized = serializeInboundEnvelope(envelope);
  return parseAgentMessageEnvelopeSerialized(serialized);
}
