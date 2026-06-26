import { requireAuth } from '@/lib/auth/require-auth';
import { handleResetProviders } from '@/lib/settings/settings-controller';

export const runtime = 'nodejs';

export async function DELETE(): Promise<Response> {
  const auth = await requireAuth();
  if (auth instanceof Response) {
    return auth;
  }
  return handleResetProviders(auth.id);
}
