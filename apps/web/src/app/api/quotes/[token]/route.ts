import type { NextRequest } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await context.params;
  return proxyAuthedApiRequest(req, `/quotes/${encodeURIComponent(token)}`, {
    method: 'GET',
  });
}
