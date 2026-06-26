export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { bootstrapUsers } = await import('./lib/auth/bootstrap-users');
    await bootstrapUsers();
    const { installWebMcpClientResolver } = await import('./lib/mcp/web-mcp-port');
    installWebMcpClientResolver();
    const { setChatStore, installMemoryPort } = await import('@meek/agent-core');
    const { chatStorePort } = await import('@meek/chat-store');
    setChatStore(chatStorePort);
    installMemoryPort();
  }
}
