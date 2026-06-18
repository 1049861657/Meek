import type { AgentMessageEnvelopeSerialized } from './channel.types.js';

export function formatInboundLogFields(envelope: AgentMessageEnvelopeSerialized): string {
  return [
    `traceId=${envelope.trace.traceId}`,
    `sessionKey=${envelope.sessionKey}`,
    `channel=${envelope.channel}`,
    `requestId=${envelope.channelMeta.requestId}`,
  ].join(' ');
}

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
  console.info(`[BUS] inbound processing ${formatInboundLogFields(envelope)}${suffix}`);
}
