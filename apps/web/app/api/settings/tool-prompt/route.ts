import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { requireAuth } from '@/lib/auth/require-auth';
import {
  handleGetToolPrompt,
  handleResetToolPrompt,
  handleSaveToolPrompt,
} from '@/lib/settings/settings-controller';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const principal = await resolvePrincipal();
  return handleGetToolPrompt(principal);
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAuth();
  if (auth instanceof Response) {
    return auth;
  }
  const body: unknown = await req.json();
  return handleSaveToolPrompt(auth.id, body);
}
