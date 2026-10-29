import type { NextRequest } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

export async function POST(req: NextRequest) {
  return proxyAuthedApiRequest(req, '/auth/logout-all', { method: 'POST', body: '' });
}
