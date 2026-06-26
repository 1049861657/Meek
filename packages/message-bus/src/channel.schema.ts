import { z } from 'zod';

import type {
  AgentMessageEnvelopeSerialized,
  AgentOutboundEnvelope,
  ChatOptions,
} from './channel.types.js';

const chatOptionsSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().optional(),
  maxTokens: z.number().optional(),
  enableTools: z.boolean().optional(),
  enablePrompts: z.boolean().optional(),
  maxToolCallRounds: z.number().optional(),
  enableAutoCompact: z.boolean().optional(),
  compactModel: z.string().optional(),
  mcpServerIds: z.array(z.string()).optional(),
  enabledToolNames: z.array(z.string()).optional(),
  enabledSystemToolNames: z.array(z.string()).optional(),
  permissionMode: z.enum(['open', 'interactive', 'locked']).optional(),
  skipMemory: z.boolean().optional(),
}) satisfies z.ZodType<ChatOptions>;

const internalMessageSchema = z.record(z.string(), z.unknown());

const agentInboundPayloadSchema = z.object({
  messages: z.array(internalMessageSchema).min(1),
  chatOptions: chatOptionsSchema.optional(),
});

const webChannelMetaSerializedSchema = z.object({
  requestId: z.string().min(1),
  webChatSessionId: z.string().min(1),
  vendor: z.string().optional(),
  userId: z.string().optional(),
});

const feishuChannelMetaSerializedSchema = z.object({
  requestId: z.string().min(1),
  messageId: z.string().min(1),
  chatId: z.string().min(1),
  vendor: z.string().optional(),
});

const dingtalkChannelMetaSerializedSchema = z.object({
  requestId: z.string().min(1),
  msgId: z.string().min(1),
  conversationId: z.string().min(1),
  sessionWebhook: z.string().url(),
  sessionWebhookExpiredTime: z.number(),
  robotCode: z.string().optional(),
  conversationType: z.string().optional(),
  vendor: z.string().optional(),
});

const agentTraceSchema = z.object({
  traceId: z.string().min(1),
  idempotencyKey: z.string().min(1),
});

const webAgentMessageEnvelopeSerializedSchema = z.object({
  id: z.string().min(1),
  source: z.literal('web:api'),
  type: z.literal('agent.message.inbound'),
  time: z.string().min(1),
  channel: z.literal('web'),
  sessionKey: z.string().min(1),
  channelMeta: webChannelMetaSerializedSchema,
  payload: agentInboundPayloadSchema,
  trace: agentTraceSchema,
});

const feishuAgentMessageEnvelopeSerializedSchema = z.object({
  id: z.string().min(1),
  source: z.literal('feishu:im'),
  type: z.literal('agent.message.inbound'),
  time: z.string().min(1),
  channel: z.literal('feishu'),
  sessionKey: z.string().min(1),
  channelMeta: feishuChannelMetaSerializedSchema,
  payload: agentInboundPayloadSchema,
  trace: agentTraceSchema,
});

const dingtalkAgentMessageEnvelopeSerializedSchema = z.object({
  id: z.string().min(1),
  source: z.literal('dingtalk:im'),
  type: z.literal('agent.message.inbound'),
  time: z.string().min(1),
  channel: z.literal('dingtalk'),
  sessionKey: z.string().min(1),
  channelMeta: dingtalkChannelMetaSerializedSchema,
  payload: agentInboundPayloadSchema,
  trace: agentTraceSchema,
});

export const agentMessageEnvelopeSerializedSchema = z.discriminatedUnion('channel', [
  webAgentMessageEnvelopeSerializedSchema,
  feishuAgentMessageEnvelopeSerializedSchema,
  dingtalkAgentMessageEnvelopeSerializedSchema,
]);

const chunkPayloadSchema = z.record(z.string(), z.unknown());

const contextCompactedPayloadSchema = z.object({
  summaryContent: z.string().optional(),
});

const usageOutboundPayloadSchema = z.object({
  requestId: z.string().min(1),
  promptTokens: z.number(),
  completionTokens: z.number(),
  totalTokens: z.number(),
  elapsedTime: z.string(),
  hasReasoning: z.boolean(),
  hasTool: z.boolean(),
});

const doneOutboundPayloadSchema = z.object({
  requestId: z.string().min(1),
  finish_reason: z.string().optional(),
});

const errorOutboundPayloadSchema = z.object({
  requestId: z.string().min(1),
  error: z.string().min(1),
});

const outboundEnvelopeBaseSchema = {
  sessionKey: z.string().min(1),
  requestId: z.string().min(1),
};

const agentOutboundEnvelopeSchema = z.discriminatedUnion('kind', [
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('web'),
    kind: z.literal('chunk'),
    payload: chunkPayloadSchema,
  }),
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('web'),
    kind: z.literal('context_compacted'),
    payload: contextCompactedPayloadSchema,
  }),
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('web'),
    kind: z.literal('usage'),
    payload: usageOutboundPayloadSchema,
  }),
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('web'),
    kind: z.literal('done'),
    payload: doneOutboundPayloadSchema,
  }),
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('web'),
    kind: z.literal('error'),
    payload: errorOutboundPayloadSchema,
  }),
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('feishu'),
    kind: z.literal('chunk'),
    payload: chunkPayloadSchema,
  }),
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('feishu'),
    kind: z.literal('context_compacted'),
    payload: contextCompactedPayloadSchema,
  }),
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('feishu'),
    kind: z.literal('usage'),
    payload: usageOutboundPayloadSchema,
  }),
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('feishu'),
    kind: z.literal('done'),
    payload: doneOutboundPayloadSchema,
  }),
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('feishu'),
    kind: z.literal('error'),
    payload: errorOutboundPayloadSchema,
  }),
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('dingtalk'),
    kind: z.literal('chunk'),
    payload: chunkPayloadSchema,
  }),
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('dingtalk'),
    kind: z.literal('context_compacted'),
    payload: contextCompactedPayloadSchema,
  }),
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('dingtalk'),
    kind: z.literal('usage'),
    payload: usageOutboundPayloadSchema,
  }),
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('dingtalk'),
    kind: z.literal('done'),
    payload: doneOutboundPayloadSchema,
  }),
  z.object({
    ...outboundEnvelopeBaseSchema,
    channel: z.literal('dingtalk'),
    kind: z.literal('error'),
    payload: errorOutboundPayloadSchema,
  }),
]) as z.ZodType<AgentOutboundEnvelope>;

export function parseAgentMessageEnvelopeSerialized(
  input: unknown
): AgentMessageEnvelopeSerialized {
  return agentMessageEnvelopeSerializedSchema.parse(input) as unknown as AgentMessageEnvelopeSerialized;
}

export function parseAgentOutboundEnvelope(input: unknown): AgentOutboundEnvelope {
  return agentOutboundEnvelopeSchema.parse(input);
}
