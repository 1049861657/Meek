import { handleGetQuickMessages } from '@/lib/config/quick-messages';

export const runtime = 'nodejs';

const CACHE_MAX_AGE_SEC = 300;

export async function GET(): Promise<Response> {
  const result = await handleGetQuickMessages();
  const cacheControl =
    result.status === 200
      ? `public, max-age=${CACHE_MAX_AGE_SEC}`
      : 'no-store';

  return Response.json(result.body, {
    status: result.status,
    headers: {
      'Cache-Control': cacheControl,
    },
  });
}
