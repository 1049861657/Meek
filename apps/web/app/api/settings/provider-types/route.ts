import { handleGetProviderTypes } from '@/lib/settings/settings-controller';

export const runtime = 'nodejs';

export async function GET(): Promise<Response> {
  return handleGetProviderTypes();
}
