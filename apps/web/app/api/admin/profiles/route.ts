import {
  handleCreateProfile,
  handleListProfiles,
} from '@/lib/admin/admin-controller';
import { requireSuperAdmin } from '@/lib/auth/require-super-admin';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  return handleListProfiles();
}

export async function POST(): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  return handleCreateProfile();
}
