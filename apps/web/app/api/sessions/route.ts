import { requireAuth } from '@/lib/auth/require-auth';
import {
  handleCreateSession,
  handleListSessions,
} from '@/lib/sessions/sessions-controller';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const auth = await requireAuth();
  if (auth instanceof Response) {
    return auth;
  }
  return handleListSessions(auth.id);
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireAuth();
  if (auth instanceof Response) {
    return auth;
  }
  const body: unknown = await req.json().catch(() => ({}));
  return handleCreateSession(auth.id, body);
}
