import { handleResetProfile } from '@/lib/admin/admin-controller';
import { requireSuperAdmin } from '@/lib/auth/require-super-admin';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ profileId: string }> }
): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  void (await context.params).profileId;
  return handleResetProfile();
}
