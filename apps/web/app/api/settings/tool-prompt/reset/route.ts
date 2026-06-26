import { requireAuth } from '@/lib/auth/require-auth';
import { handleResetToolPrompt } from '@/lib/settings/settings-controller';

export const runtime = 'nodejs';

export async function DELETE(): Promise<Response> {
  const auth = await requireAuth();
  if (auth instanceof Response) {
    return auth;
  }
  return handleResetToolPrompt(auth.id);
}
