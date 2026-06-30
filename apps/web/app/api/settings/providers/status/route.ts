import { requireAuth } from '@/lib/auth/require-auth';
import { handleGetProviderConnectivityStatus } from '@/lib/settings/settings-controller';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const auth = await requireAuth();
  if (auth instanceof Response) {
    return auth;
  }
  return handleGetProviderConnectivityStatus(auth.id);
}
