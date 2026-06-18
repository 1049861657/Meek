import type { ChunkResponse } from '@meek/agent-core';
import type { AgentMessageEnvelopeSerialized, WebAgentMessageEnvelopeSerialized } from '@meek/message-bus';
import {
  envelopeToHarnessInput,
  isWebInboundEnvelope,
  logInboundDequeue,
  publishOutboundEvent,
  resolvePermissionSessionKey,
  resolveWebProfile,
  subscribeAbortSignal,
  type AgentOutboundEnvelope,
} from '@meek/message-bus';

import { getHarnessProvider, resolveDefaultModel } from '../lib/runtime-bootstrap.js';

const INBOUND_AI_UNAVAILABLE_MESSAGE =
  '当前渠道绑定的账号未配置可用的 AI 供应商，请联系管理员。';

function isAbortError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === 'AbortError' || error.name === 'APIUserAbortError';
}

async function routeInboundError(
  envelope: AgentMessageEnvelopeSerialized,
  requestId: string,
  error: string
): Promise<void> {
  await publishOutboundEvent(requestId, {
    sessionKey: envelope.sessionKey,
    channel: 'web',
    requestId,
    kind: 'error',
    payload: { requestId, error },
  });
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
  await publishOutboundEvent(requestId, {
    sessionKey: envelope.sessionKey,
    channel: 'web',
    requestId,
    kind: 'context_compacted',
    payload,
  });
}

async function routeOutbound(envelope: AgentOutboundEnvelope): Promise<void> {
  await publishOutboundEvent(envelope.requestId, envelope);
}

async function runHarnessForEnvelope(
  envelope: WebAgentMessageEnvelopeSerialized,
  requestId: string,
  signal?: AbortSignal
): Promise<void> {
  const configUserId = envelope.channelMeta.userId ?? null;
  const vendor = envelope.channelMeta.vendor;
  const defaultModel = await resolveDefaultModel(configUserId);
  const resolved = resolveWebProfile(envelope, defaultModel);
  const { messages, chatOptions } = envelopeToHarnessInput(envelope);

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

  const wallStarted = Date.now();

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
      await routeOutbound({
        sessionKey: envelope.sessionKey,
        channel: 'web',
        requestId,
        kind: 'chunk',
        payload: chunk,
      });
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
      channel: 'web',
      sessionKey: resolvePermissionSessionKey(envelope),
      permissionMode: resolved.permissionMode,
    }
  );

  if (signal?.aborted) {
    return;
  }

  const elapsedTime = (Date.now() - wallStarted) / 1000;
  await routeOutbound({
    sessionKey: envelope.sessionKey,
    channel: 'web',
    requestId,
    kind: 'usage',
    payload: {
      requestId,
      ...result.usage,
      elapsedTime: elapsedTime.toFixed(2),
      hasReasoning: Boolean(result.reasoning_content),
      hasTool: Boolean(result.tool_calls && result.tool_calls.length > 0),
    },
  });
  await routeOutbound({
    sessionKey: envelope.sessionKey,
    channel: 'web',
    requestId,
    kind: 'done',
    payload: {
      requestId,
      finish_reason: result.finish_reason,
    },
  });
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

export async function processInboundJob(
  envelope: AgentMessageEnvelopeSerialized
): Promise<void> {
  if (isWebInboundEnvelope(envelope)) {
    await processWebInboundJob(envelope);
    return;
  }
  console.warn(
    `[BUS] Inbound Worker 跳过未知 channel=${String((envelope as { channel?: string }).channel)}`
  );
}
