import { requireAuth } from '@/lib/auth/require-auth';
import { handleGetMessages } from '@/lib/sessions/sessions-controller';

export const runtime = 'nodejs';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAuth();
  if (auth instanceof Response) {
    return auth;
  }
  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  return handleGetMessages(auth.id, id?.trim() ?? '', searchParams);
}
