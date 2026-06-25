import { setMcpConnectionService } from '@meek/agent-core';
import { McpConnectionService } from '@meek/mcp-runtime';

export function wireMcpConnectionService(): void {
  setMcpConnectionService({
    async ensureForChat(serverIds, configUserId, chatRequestId) {
      const { reachableIds } = await McpConnectionService.ensureForChat(
        serverIds,
        configUserId,
        chatRequestId
      );
      return { reachableIds };
    },
  });
}

export { McpConnectionService };
