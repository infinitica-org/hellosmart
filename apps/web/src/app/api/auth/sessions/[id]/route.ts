import type { NextRequest } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return proxyAuthedApiRequest(req, `/auth/sessions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
