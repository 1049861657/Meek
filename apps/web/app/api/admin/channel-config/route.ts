import {
  handleGetChannelConfig,
  handleSaveChannelConfig,
} from '@/lib/admin/admin-controller';
import { requireSuperAdmin } from '@/lib/auth/require-super-admin';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  const url = new URL(req.url);
  return handleGetChannelConfig(
    url.searchParams.get('channel'),
    url.searchParams.get('boundUserId')
  );
}

export async function PUT(req: Request): Promise<Response> {
  const auth = await requireSuperAdmin();
  if (auth instanceof Response) {
    return auth;
  }
  const body: unknown = await req.json();
  return handleSaveChannelConfig(body);
}
