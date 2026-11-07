import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Endpoint: POST /api/candidate/assessments/:id/consent
 * Alias route proxying pre-connect consent agreement to backend /candidate/workspace/:id/consent (BR-06, BR-12, BR-31).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const upstreamRes = await proxyAuthedApiRequest(
    req,
    `/candidate/workspace/${encodeURIComponent(id)}/consent`,
  );

  // Provide graceful fallback during local development when backend is offline
  if (upstreamRes.status === 503 && process.env.NODE_ENV !== 'production') {
    return NextResponse.json({
      success: true,
      status: 'in_progress',
      firstConnectAt: new Date().toISOString(),
      consentId: `csnt-dev-${id}`,
      textVersion: 'v1.0',
      acceptedAt: new Date().toISOString(),
    });
  }

  return upstreamRes;
}
