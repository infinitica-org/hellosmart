import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Route Handler: Resend Candidate Invitation Link
 * Proxies POST /candidates/:id/resend-invite to upstream Fastify API.
 * Enforces session cookie forwarding and CSRF protection (CO-017, BR-24, BR-31, S1-T05-4).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const search = req.nextUrl.search;
  return proxyAuthedApiRequest(
    req,
    `/candidates/${encodeURIComponent(id)}/resend-invite${search}`,
  );
}
