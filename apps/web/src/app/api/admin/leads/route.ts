import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const search = req.nextUrl.search || '';
  return proxyAuthedApiRequest(req, `/admin/leads${search}`);
}

