import { handleGetFeatureConfig } from '@/lib/config/features';

export const runtime = 'nodejs';

const CACHE_MAX_AGE_SEC = 300;

export async function GET(): Promise<Response> {
  const result = handleGetFeatureConfig();
  if (!('success' in result) || !result.success) {
    return Response.json(result, {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }

  return Response.json(result, {
    headers: {
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE_SEC}`,
    },
  });
}
