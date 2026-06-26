import {
  handleGetSeedFollow,
  handleSetSeedFollow,
} from '@/lib/users/users-controller';
import { requireSuperAdmin } from '@/lib/auth/require-super-admin';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  return handleGetSeedFollow();
}

export async function PUT(req: Request): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  const body: unknown = await req.json();
  return handleSetSeedFollow(body);
}
