import type { NextRequest } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

export async function POST(req: NextRequest): Promise<Response> {
  return proxyAuthedApiRequest(req, '/auth/invitations/accept', {
    method: 'POST',
  });
}

