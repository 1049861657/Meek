import {
  handleDeleteProfile,
  handleGetProfile,
  handleUpdateProfile,
} from '@/lib/admin/admin-controller';
import { requireSuperAdmin } from '@/lib/auth/require-super-admin';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  context: { params: Promise<{ profileId: string }> }
): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  const { profileId } = await context.params;
  return handleGetProfile(profileId?.trim() ?? '');
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ profileId: string }> }
): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  const { profileId } = await context.params;
  const body: unknown = await req.json();
  return handleUpdateProfile(profileId?.trim() ?? '', body);
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ profileId: string }> }
): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  void (await context.params).profileId;
  return handleDeleteProfile();
}
