import {
  ChatConfig,
  ToolsConfig,
  resolveEnableAutoCompact,
  resolveMaxToolCallRounds,
  resolvePermissionMode,
} from '@meek/agent-core';
import type { ResolvedProfile } from '@meek/shared';

import type { WebAgentMessageEnvelopeSerialized } from './channel.types.js';
import { envelopeToHarnessInput } from './envelope-mapper.js';

/**
 * M1 简化 Profile 解析（M4 config-plane 前：defaults + body chatOptions）。
 */
export function resolveWebProfile(
  envelope: WebAgentMessageEnvelopeSerialized,
  defaultModel: string
): ResolvedProfile {
  const { chatOptions } = envelopeToHarnessInput(envelope);
  const userId = envelope.channelMeta.userId;
  const chatSessionId = envelope.channelMeta.webChatSessionId;
  const vendor = envelope.channelMeta.vendor;

  return {
    profileId: 'default-web',
    vendor,
    model: chatOptions.model ?? defaultModel,
    temperature: chatOptions.temperature ?? ChatConfig.defaultTemperature,
    maxTokens: chatOptions.maxTokens ?? ChatConfig.defaultMaxTokens,
    enableTools: chatOptions.enableTools ?? ToolsConfig.enableMCPTools,
    enablePrompts: chatOptions.enablePrompts ?? ToolsConfig.enablePrompts,
    maxToolCallRounds: resolveMaxToolCallRounds(chatOptions.maxToolCallRounds),
    enableAutoCompact: resolveEnableAutoCompact(chatOptions.enableAutoCompact),
    compactModel: chatOptions.compactModel,
    mcpServerIds: Array.isArray(chatOptions.mcpServerIds) ? [...chatOptions.mcpServerIds] : [],
    enabledToolNames: chatOptions.enabledToolNames
      ? [...chatOptions.enabledToolNames]
      : undefined,
    enabledSystemToolNames: chatOptions.enabledSystemToolNames
      ? [...chatOptions.enabledSystemToolNames]
      : undefined,
    toolPrompt: '',
    permissionMode: resolvePermissionMode(
      'web',
      chatOptions.permissionMode ?? 'open'
    ),
    skipMemory: chatOptions.skipMemory ?? !userId,
    documentSessionId: chatSessionId,
    userId,
    configUserId: userId ?? null,
    chatSessionId,
    memoryScope: userId ? { channel: 'web', userId } : { channel: 'web' },
  };
}
