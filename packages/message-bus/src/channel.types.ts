import type { ChunkResponse, InternalMessage, UsageInfo } from '@meek/agent-core';
import type { ChatAgentOptions, ChannelId } from '@meek/shared';

export type { ChannelId };

/** 入站 Envelope CloudEvents 核心字段 */
export interface AgentEnvelopeCore {
  id: string;
  source: string;
  type: string;
  time: string;
}

/** Web 入站 channelMeta（序列化 JSON，不含 abortSignal） */
export interface WebChannelMetaSerialized {
  requestId: string;
  webChatSessionId: string;
  vendor?: string;
  userId?: string;
}

/** 飞书入站 channelMeta（序列化 JSON） */
export interface FeishuChannelMetaSerialized {
  requestId: string;
  messageId: string;
  chatId: string;
  vendor?: string;
}

/** 飞书入站 channelMeta（进程内 runtime） */
export interface FeishuChannelMeta extends FeishuChannelMetaSerialized {
  abortSignal?: AbortSignal;
}

/** 钉钉入站 channelMeta（序列化 JSON） */
export interface DingtalkChannelMetaSerialized {
  requestId: string;
  msgId: string;
  conversationId: string;
  sessionWebhook: string;
  sessionWebhookExpiredTime: number;
  robotCode?: string;
  conversationType?: string;
  vendor?: string;
}

/** 钉钉入站 channelMeta（进程内 runtime） */
export interface DingtalkChannelMeta extends DingtalkChannelMetaSerialized {
  abortSignal?: AbortSignal;
}

/** Web 入站 channelMeta（进程内 runtime，含 AbortSignal） */
export interface WebChannelMeta extends WebChannelMetaSerialized {
  abortSignal?: AbortSignal;
}

/** 聊天选项（全部可选，Worker 侧 pickDefined 透传） */
export type ChatOptions = ChatAgentOptions;

/** 入站 payload */
export interface AgentInboundPayload {
  messages: InternalMessage[];
  chatOptions?: ChatOptions;
}

/** 分布式追踪与幂等 */
export interface AgentTrace {
  traceId: string;
  idempotencyKey: string;
}

/** Web 入站 Envelope（进程内 runtime） */
export interface WebAgentMessageEnvelope extends AgentEnvelopeCore {
  source: 'web:api';
  type: 'agent.message.inbound';
  channel: 'web';
  sessionKey: string;
  channelMeta: WebChannelMeta;
  payload: AgentInboundPayload;
  trace: AgentTrace;
}

/** 飞书入站 Envelope（进程内 runtime） */
export interface FeishuAgentMessageEnvelope extends AgentEnvelopeCore {
  source: 'feishu:im';
  type: 'agent.message.inbound';
  channel: 'feishu';
  sessionKey: string;
  channelMeta: FeishuChannelMeta;
  payload: AgentInboundPayload;
  trace: AgentTrace;
}

/** 钉钉入站 Envelope（进程内 runtime） */
export interface DingtalkAgentMessageEnvelope extends AgentEnvelopeCore {
  source: 'dingtalk:im';
  type: 'agent.message.inbound';
  channel: 'dingtalk';
  sessionKey: string;
  channelMeta: DingtalkChannelMeta;
  payload: AgentInboundPayload;
  trace: AgentTrace;
}

/** 入站 Envelope 联合（进程内 runtime） */
export type AgentMessageEnvelope =
  | WebAgentMessageEnvelope
  | FeishuAgentMessageEnvelope
  | DingtalkAgentMessageEnvelope;

/** Web 入队 JSON 形态（不含 abortSignal） */
export interface WebAgentMessageEnvelopeSerialized
  extends Omit<WebAgentMessageEnvelope, 'channelMeta'> {
  channelMeta: WebChannelMetaSerialized;
}

/** 飞书入队 JSON 形态 */
export interface FeishuAgentMessageEnvelopeSerialized
  extends Omit<FeishuAgentMessageEnvelope, 'channelMeta'> {
  channelMeta: FeishuChannelMetaSerialized;
}

/** 钉钉入队 JSON 形态 */
export interface DingtalkAgentMessageEnvelopeSerialized
  extends Omit<DingtalkAgentMessageEnvelope, 'channelMeta'> {
  channelMeta: DingtalkChannelMetaSerialized;
}

/** 入队 JSON Envelope 联合 */
export type AgentMessageEnvelopeSerialized =
  | WebAgentMessageEnvelopeSerialized
  | FeishuAgentMessageEnvelopeSerialized
  | DingtalkAgentMessageEnvelopeSerialized;

/** 出站 kind */
export type AgentOutboundKind =
  | 'chunk'
  | 'context_compacted'
  | 'usage'
  | 'done'
  | 'error';

/** context_compacted 出站 payload */
export interface ContextCompactedPayload {
  summaryContent?: string;
}

/** usage 出站 payload（与 ai.controller chatStream 一致） */
export interface UsageOutboundPayload extends UsageInfo {
  requestId: string;
  elapsedTime: string;
  hasReasoning: boolean;
  hasTool: boolean;
}

/** done 出站 payload */
export interface DoneOutboundPayload {
  requestId: string;
  finish_reason?: string;
}

/** error 出站 payload */
export interface ErrorOutboundPayload {
  requestId: string;
  error: string;
}

/** 出站 payload 联合（按 kind 区分） */
export type AgentOutboundPayload =
  | ChunkResponse
  | ContextCompactedPayload
  | UsageOutboundPayload
  | DoneOutboundPayload
  | ErrorOutboundPayload;

/** 出站 Envelope 基础字段 */
interface AgentOutboundEnvelopeBase {
  sessionKey: string;
  requestId: string;
  kind: AgentOutboundKind;
  payload: AgentOutboundPayload;
}

/** Web 出站 Envelope（→ SSE） */
export interface WebAgentOutboundEnvelope extends AgentOutboundEnvelopeBase {
  channel: 'web';
}

/** 飞书出站 Envelope（→ im.v1.message.reply） */
export interface FeishuAgentOutboundEnvelope extends AgentOutboundEnvelopeBase {
  channel: 'feishu';
}

/** 钉钉出站 Envelope（→ sessionWebhook POST） */
export interface DingtalkAgentOutboundEnvelope extends AgentOutboundEnvelopeBase {
  channel: 'dingtalk';
}

/** 出站 Envelope 联合 */
export type AgentOutboundEnvelope =
  | WebAgentOutboundEnvelope
  | FeishuAgentOutboundEnvelope
  | DingtalkAgentOutboundEnvelope;

export function isWebInboundEnvelope(
  envelope: AgentMessageEnvelopeSerialized
): envelope is WebAgentMessageEnvelopeSerialized {
  return envelope.channel === 'web';
}

export function isFeishuInboundEnvelope(
  envelope: AgentMessageEnvelopeSerialized
): envelope is FeishuAgentMessageEnvelopeSerialized {
  return envelope.channel === 'feishu';
}

export function isDingtalkInboundEnvelope(
  envelope: AgentMessageEnvelopeSerialized
): envelope is DingtalkAgentMessageEnvelopeSerialized {
  return envelope.channel === 'dingtalk';
}
