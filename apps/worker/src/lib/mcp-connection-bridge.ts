import { setMcpConnectionService } from '@meek/agent-core';
import { getMcpClientForUser } from '@meek/mcp-runtime';

export function wireMcpConnectionService(): void {
  setMcpConnectionService({
    async ensureForChat(serverIds, configUserId, chatRequestId) {
      const client = getMcpClientForUser(configUserId);
      client.beginChatEphemeralScope(chatRequestId);
      const { reachableIds } = await client.partitionServerIdsByReachability(serverIds, {
        mode: 'chat-ephemeral',
        chatRequestId,
      });
      return { reachableIds };
    },
  });
}
