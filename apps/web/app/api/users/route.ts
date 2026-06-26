import {
  handleListUsers,
} from '@/lib/users/users-controller';
import { requireSuperAdmin } from '@/lib/auth/require-super-admin';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  return handleListUsers();
}
