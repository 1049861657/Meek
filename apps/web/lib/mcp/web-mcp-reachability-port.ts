import { setMcpReachabilityPartitioner } from '@meek/config-plane';

import { workerMcpPartitionForPersistence } from '@/lib/worker/worker-client';

/** Web 启动时注入：MCP 连通性探测委托 Worker（Web 仅 BFF） */
export function installWebMcpReachabilityPartitioner(): void {
  setMcpReachabilityPartitioner(async (serverIds, configUserId, enableTools) => {
    const result = await workerMcpPartitionForPersistence(configUserId, serverIds, enableTools);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.data;
  });
}
