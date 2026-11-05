import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Route Handler: Candidate Resource Operations
 * Proxies PATCH (update name/email) and DELETE (soft delete)
 * to upstream Fastify API (/api/v1/candidates/:id).
 * Enforces session cookie forwarding and CSRF protection (CO-015, CO-016, S1-T05-4).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return proxyAuthedApiRequest(req, `/candidates/${encodeURIComponent(id)}`);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return proxyAuthedApiRequest(req, `/candidates/${encodeURIComponent(id)}`);
}
