import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Endpoint: POST /api/candidate/assessments/:id/submit
 * Alias route proxying candidate final submission to backend (BR-08, BR-11, BR-31).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const upstreamRes = await proxyAuthedApiRequest(
    req,
    `/candidate/workspace/${encodeURIComponent(id)}/submit`,
  );

  // Provide graceful fallback during local development when backend is offline
  if (upstreamRes.status === 503 && process.env.NODE_ENV !== 'production') {
    return NextResponse.json({
      success: true,
      submissionId: `sub-dev-${id}`,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
    });
  }

  return upstreamRes;
}
