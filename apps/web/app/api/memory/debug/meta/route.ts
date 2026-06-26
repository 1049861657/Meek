import { handleGetMemoryDebugMeta } from '@/lib/memory/memory-debug-controller';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return handleGetMemoryDebugMeta();
}
