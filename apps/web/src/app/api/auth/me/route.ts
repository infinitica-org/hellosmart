import type { NextRequest } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

export async function GET(req: NextRequest) {
  return proxyAuthedApiRequest(req, '/me');
}
