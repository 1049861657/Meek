import { resolvePrincipal } from '@/lib/chat/resolve-principal';
import { handleGetSystemPromptSections } from '@/lib/settings/settings-controller';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  const principal = await resolvePrincipal();
  const { searchParams } = new URL(req.url);
  return handleGetSystemPromptSections(principal, searchParams);
}
