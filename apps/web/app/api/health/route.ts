/**
 * API Route 模板：stdio/MCP/Prisma 须使用 Node.js runtime，禁止 Edge。
 */
export const runtime = 'nodejs';

export function GET(): Response {
  return Response.json({ status: 'ok', service: 'meek-web' });
}
