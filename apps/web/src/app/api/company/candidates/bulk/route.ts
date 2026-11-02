import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

export async function POST(req: NextRequest): Promise<NextResponse> {
  return proxyAuthedApiRequest(req, '/candidates/bulk');
}

