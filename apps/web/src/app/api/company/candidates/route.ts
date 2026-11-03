import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Route Handler: Candidates Collection
 * Proxies GET (list with search, status, pagination) and POST (single candidate creation)
 * to upstream Fastify API (/api/v1/candidates).
 * Enforces session cookie forwarding and CSRF protection (BR-01, CO-014, S1-T05-4).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const search = req.nextUrl.search;
  return proxyAuthedApiRequest(req, `/candidates${search}`);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return proxyAuthedApiRequest(req, '/candidates');
}
