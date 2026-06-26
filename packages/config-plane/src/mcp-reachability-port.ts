export interface McpPersistencePartition {
  persistIds: string[];
  skipped: Array<{ id: string; name: string }>;
}

export type McpReachabilityPartitioner = (
  serverIds: string[],
  configUserId: string | null,
  enableTools: boolean
) => Promise<McpPersistencePartition>;

let partitioner: McpReachabilityPartitioner | null = null;

export function setMcpReachabilityPartitioner(next: McpReachabilityPartitioner): void {
  partitioner = next;
}

export async function partitionMcpServerIdsForPersistence(
  serverIds: string[],
  configUserId: string | null,
  enableTools: boolean
): Promise<McpPersistencePartition> {
  if (!partitioner) {
    throw new Error('McpReachabilityPartitioner 未注入：调用 setMcpReachabilityPartitioner');
  }
  return partitioner(serverIds, configUserId, enableTools);
}
