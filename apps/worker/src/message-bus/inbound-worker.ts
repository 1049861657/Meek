import type { ChunkResponse } from '@meek/agent-core';
import { resolveProfile } from '@meek/config-plane';
import type {
  AgentMessageEnvelopeSerialized,
  AgentOutboundEnvelope,
  AgentOutboundKind,
  DingtalkAgentMessageEnvelopeSerialized,
  FeishuAgentMessageEnvelopeSerialized,
  WebAgentMessageEnvelopeSerialized,
} from '@meek/message-bus';
import {
  envelopeToHarnessInput,
  isDingtalkInboundEnvelope,
  isFeishuInboundEnvelope,
  isWebInboundEnvelope,
  logInboundDequeue,
  resolvePermissionSessionKey,
  subscribeAbortSignal,
} from '@meek/message-bus';

import { getDingtalkChannelAdapter } from '../channels/dingtalk/dingtalk-channel.adapter.js';
import { getFeishuChannelAdapter } from '../channels/feishu/feishu-channel.adapter.js';
import { getHarnessProvider } from '../lib/runtime-bootstrap.js';
import { McpConnectionService } from '../lib/mcp-connection-bridge.js';
import { routeOutboundEnvelope } from './outbound-router.js';

const INBOUND_AI_UNAVAILABLE_MESSAGE =
  '当前渠道绑定的账号未配置可用的 AI 供应商，请联系管理员。';

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === 'AbortError' || error.name === 'APIUserAbortError';
}

function buildOutboundEnvelope(
  envelope: AgentMessageEnvelopeSerialized,
  requestId: string,
  kind: AgentOutboundKind,
  payload: AgentOutboundEnvelope['payload']
): AgentOutboundEnvelope {
  return {
    sessionKey: envelope.sessionKey,
    channel: envelope.channel,
    requestId,
    kind,
    payload,
  };
}

async function routeInboundError(
  envelope: AgentMessageEnvelopeSerialized,
  requestId: string,
  error: string
): Promise<void> {
  await routeOutboundEnvelope(
    buildOutboundEnvelope(envelope, requestId, 'error', { requestId, error })
  );
}

async function routeContextCompacted(
  envelope: AgentMessageEnvelopeSerialized,
  chunk: ChunkResponse
): Promise<void> {
  const requestId = envelope.channelMeta.requestId;
  const payload =
    typeof chunk.summaryContent === 'string' && chunk.summaryContent.length > 0
      ? { summaryContent: chunk.summaryContent }
      : {};
  await routeOutboundEnvelope(
    buildOutboundEnvelope(envelope, requestId, 'context_compacted', payload)
  );
}

async function routeOutbound(
  envelope: AgentMessageEnvelopeSerialized,
  requestId: string,
  kind: AgentOutboundKind,
  payload: AgentOutboundEnvelope['payload']
): Promise<void> {
  await routeOutboundEnvelope(buildOutboundEnvelope(envelope, requestId, kind, payload));
}

/**
 * Envelope → Harness → 出站路由（web：Redis；feishu/dingtalk：Adapter）。
 */
async function runHarnessForEnvelope(
  envelope: AgentMessageEnvelopeSerialized,
  requestId: string,
  signal?: AbortSignal
): Promise<void> {
  const resolved = await resolveProfile(envelope);
  const vendor = resolved.vendor ?? envelope.channelMeta.vendor;
  const configUserId = resolved.configUserId ?? null;

  logInboundDequeue(envelope, {
    profileId: resolved.profileId,
    vendor: vendor ?? 'default',
    mcpCount: resolved.mcpServerIds.length,
    permissionMode: resolved.permissionMode,
  });

  const service = await getHarnessProvider(configUserId, vendor);
  if (!service) {
    console.warn(`[BUS] Inbound Worker 跳过：无可用 AI 服务 requestId=${requestId}`);
    await routeInboundError(envelope, requestId, INBOUND_AI_UNAVAILABLE_MESSAGE);
    return;
  }

  const { messages } = envelopeToHarnessInput(envelope);
  const wallStarted = Date.now();
  McpConnectionService.beginChatScope(configUserId, requestId);

  try {
    const result = await service.chatStream(
      messages,
      async (chunk, done) => {
        if (done || signal?.aborted) {
          return;
        }
        if (chunk.contextCompacted) {
          await routeContextCompacted(envelope, chunk);
          return;
        }
        await routeOutbound(envelope, requestId, 'chunk', chunk);
      },
      resolved.model,
      resolved.temperature,
      resolved.maxTokens,
      resolved.enableTools,
      resolved.enablePrompts,
      signal,
      resolved.maxToolCallRounds,
      requestId,
      resolved.enableAutoCompact,
      resolved.compactModel,
      resolved,
      {
        channel: envelope.channel,
        sessionKey: resolvePermissionSessionKey(envelope),
        permissionMode: resolved.permissionMode,
      }
    );

    if (signal?.aborted) {
      return;
    }

    const elapsedTime = (Date.now() - wallStarted) / 1000;
    await routeOutbound(envelope, requestId, 'usage', {
      requestId,
      ...result.usage,
      elapsedTime: elapsedTime.toFixed(2),
      hasReasoning: Boolean(result.reasoning_content),
      hasTool: Boolean(result.tool_calls && result.tool_calls.length > 0),
    });
    await routeOutbound(envelope, requestId, 'done', {
      requestId,
      finish_reason: result.finish_reason,
    });
  } finally {
    await McpConnectionService.releaseChatScope(configUserId, requestId);
  }
}

async function processWebInboundJob(
  envelope: WebAgentMessageEnvelopeSerialized
): Promise<void> {
  const requestId = envelope.channelMeta.requestId;
  const abortController = new AbortController();
  const unsubscribeAbort = subscribeAbortSignal(requestId, () => {
    abortController.abort();
  });

  try {
    await runHarnessForEnvelope(envelope, requestId, abortController.signal);
  } catch (error: unknown) {
    if (abortController.signal.aborted || isAbortError(error)) {
      return;
    }
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error(`[BUS] Inbound Worker 处理失败 requestId=${requestId}:`, error);
    await routeInboundError(envelope, requestId, errMessage);
  } finally {
    unsubscribeAbort();
  }
}

async function processFeishuInboundJob(
  envelope: FeishuAgentMessageEnvelopeSerialized
): Promise<void> {
  const { requestId, messageId, chatId } = envelope.channelMeta;
  const feishuAdapter = getFeishuChannelAdapter();
  feishuAdapter.beginReply(requestId, messageId, chatId);

  try {
    await runHarnessForEnvelope(envelope, requestId);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error(`[BUS] Inbound Worker 飞书处理失败 requestId=${requestId}:`, error);
    await routeInboundError(envelope, requestId, errMessage);
  } finally {
    feishuAdapter.endReply(requestId);
  }
}

async function processDingtalkInboundJob(
  envelope: DingtalkAgentMessageEnvelopeSerialized
): Promise<void> {
  const { requestId, ...meta } = envelope.channelMeta;
  const dingtalkAdapter = getDingtalkChannelAdapter();
  dingtalkAdapter.beginReply(requestId, { requestId, ...meta });

  try {
    await runHarnessForEnvelope(envelope, requestId);
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : String(error);
    console.error(`[BUS] Inbound Worker 钉钉处理失败 requestId=${requestId}:`, error);
    await routeInboundError(envelope, requestId, errMessage);
  } finally {
    dingtalkAdapter.endReply(requestId);
  }
}

/** Inbound Worker：按 channel 分发 */
export async function processInboundJob(
  envelope: AgentMessageEnvelopeSerialized
): Promise<void> {
  if (isWebInboundEnvelope(envelope)) {
    await processWebInboundJob(envelope);
    return;
  }
  if (isFeishuInboundEnvelope(envelope)) {
    await processFeishuInboundJob(envelope);
    return;
  }
  if (isDingtalkInboundEnvelope(envelope)) {
    await processDingtalkInboundJob(envelope);
    return;
  }
  console.warn(
    `[BUS] Inbound Worker 跳过未知 channel=${String((envelope as { channel?: string }).channel)}`
  );
}
