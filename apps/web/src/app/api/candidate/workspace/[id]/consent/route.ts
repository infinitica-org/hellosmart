import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Endpoint: POST /api/candidate/workspace/:id/consent
 * Proxies to backend POST /api/v1/candidate/workspace/:id/consent (BR-06, BR-12, BR-31).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return proxyAuthedApiRequest(req, `/candidate/workspace/${encodeURIComponent(id)}/consent`);
}
