import { requireAuth } from '@/lib/auth/require-auth';
import { handleProbeDefaultProvider } from '@/lib/settings/settings-controller';

export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  const auth = await requireAuth();
  if (auth instanceof Response) {
    return auth;
  }
  return handleProbeDefaultProvider(auth.id);
}
