import { Logger } from '@meek/shared/logger';
import type { AgentMessageEnvelope, AgentMessageEnvelopeSerialized } from './channel.types.js';
import { formatInboundLogFields } from './inbound-log-fields.js';

export { formatInboundLogFields } from './inbound-log-fields.js';

/** Worker 开始处理入站任务 */
export function logInboundDequeue(
  envelope: AgentMessageEnvelopeSerialized,
  options?: { profileId?: string; vendor?: string; mcpCount?: number; permissionMode?: string }
): void {
  const extras: string[] = [];
  if (options?.profileId) {
    extras.push(`profileId=${options.profileId}`);
  }
  if (options?.vendor) {
    extras.push(`vendor=${options.vendor}`);
  }
  if (options?.mcpCount !== undefined) {
    extras.push(`mcpCount=${options.mcpCount}`);
  }
  if (options?.permissionMode) {
    extras.push(`permissionMode=${options.permissionMode}`);
  }
  const suffix = extras.length > 0 ? ` ${extras.join(' ')}` : '';
  Logger.info('BUS', `inbound processing ${formatInboundLogFields(envelope)}${suffix}`);
}

/** 幂等重复，跳过入队 */
export function logInboundSkippedDuplicate(idempotencyKey: string, requestId: string): void {
  Logger.info('BUS', `inbound skipped duplicate idempotencyKey=${idempotencyKey} requestId=${requestId}`);
}

/** Envelope 已写入 Inbound 队列 */
export function logInboundPublished(envelope: AgentMessageEnvelope): void {
  Logger.info(
    'BUS',
    `publishInbound requestId=${envelope.channelMeta.requestId} traceId=${envelope.trace.traceId} channel=${envelope.channel}`
  );
}

/** 重试耗尽后的最终失败（死信日志；队列仍 removeOnFail，与参考一致） */
export function logInboundDeadLetter(
  jobId: string,
  envelope: AgentMessageEnvelopeSerialized | undefined,
  error: Error,
  attemptsMade: number
): void {
  const fields = envelope ? formatInboundLogFields(envelope) : `jobId=${jobId}`;
  Logger.error(
    'BUS',
    `inbound dead-letter ${fields} attemptsMade=${attemptsMade} error=${error.message}`
  );
}

/** Inbound job 单次失败（尚会重试） */
export function logInboundJobFailed(
  jobId: string,
  attemptsMade: number,
  maxAttempts: number,
  error: Error
): void {
  Logger.error(
    'BUS',
    `inbound job failed jobId=${jobId} attempt=${attemptsMade}/${maxAttempts}: ${error.message}`
  );
}
