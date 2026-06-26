import {
  handleCreateRoute,
  handleListRoutes,
} from '@/lib/admin/admin-controller';
import { requireSuperAdmin } from '@/lib/auth/require-super-admin';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  const channel = new URL(req.url).searchParams.get('channel');
  return handleListRoutes(channel);
}

export async function POST(req: Request): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  const body: unknown = await req.json();
  return handleCreateRoute(body);
}
