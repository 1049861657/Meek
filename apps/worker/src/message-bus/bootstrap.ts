export interface MessageBusHandle {
  close(): Promise<void>;
}

/** M0 占位：M1 实现 Inbound Worker 订阅队列 */
export function startMessageBus(): MessageBusHandle {
  return {
    async close(): Promise<void> {
      // M1: close BullMQ worker
    },
  };
}
