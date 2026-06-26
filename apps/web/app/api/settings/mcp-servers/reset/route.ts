import { requireAuth } from '@/lib/auth/require-auth';
import { handleResetMcpServers } from '@/lib/settings/settings-controller';

export const runtime = 'nodejs';

export async function DELETE(): Promise<Response> {
  const auth = await requireAuth();
  if (auth instanceof Response) {
    return auth;
  }
  return handleResetMcpServers(auth.id);
}
