import { requireAuth } from '@/lib/auth/require-auth';
import { handleDeleteSession } from '@/lib/sessions/sessions-controller';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireAuth();
  if (auth instanceof Response) {
    return auth;
  }
  const { id } = await context.params;
  return handleDeleteSession(auth.id, id?.trim() ?? '');
}
