import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

export async function GET(req: NextRequest): Promise<NextResponse> {
  return proxyAuthedApiRequest(req, '/candidates/metrics');
}

