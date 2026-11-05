import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Route Handler: Resend Candidate Assignment Invitation Link
 * Proxies POST /candidates/:id/assignments/:assignmentId/resend-invite to upstream Fastify API.
 * Enforces session cookie forwarding and CSRF protection (CO-017, BR-24, BR-31, S1-T05-4).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> },
): Promise<NextResponse> {
  const { id, assignmentId } = await params;
  return proxyAuthedApiRequest(
    req,
    `/candidates/${encodeURIComponent(id)}/assignments/${encodeURIComponent(assignmentId)}/resend-invite`,
  );
}

