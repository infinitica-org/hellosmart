import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const search = req.nextUrl.search || '';
  return proxyAuthedApiRequest(req, `/admin/quotes${search}`);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return proxyAuthedApiRequest(req, '/admin/quotes');
}
