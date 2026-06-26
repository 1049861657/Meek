import { handleSetRole } from '@/lib/users/users-controller';
import { requireSuperAdmin } from '@/lib/auth/require-super-admin';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  const { id } = await context.params;
  const body: unknown = await req.json();
  return handleSetRole(id?.trim() ?? '', body, auth.id);
}
