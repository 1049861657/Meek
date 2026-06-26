import { handleMemoryDebugReflect } from '@/lib/memory/memory-debug-controller';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const body: unknown = await req.json().catch(() => ({}));
  return handleMemoryDebugReflect(body);
}
