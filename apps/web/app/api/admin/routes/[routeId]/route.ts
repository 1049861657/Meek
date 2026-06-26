import {
  handleDeleteRoute,
  handleUpdateRoute,
} from '@/lib/admin/admin-controller';
import { requireSuperAdmin } from '@/lib/auth/require-super-admin';

export const runtime = 'nodejs';

export async function PUT(
  req: Request,
  context: { params: Promise<{ routeId: string }> }
): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  const { routeId } = await context.params;
  const body: unknown = await req.json();
  return handleUpdateRoute(routeId?.trim() ?? '', body);
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ routeId: string }> }
): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  const { routeId } = await context.params;
  return handleDeleteRoute(routeId?.trim() ?? '');
}
