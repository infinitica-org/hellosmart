import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Endpoint: GET /api/candidate/assessments/:id/timing
 * Proxies candidate assessment timing synchronization to backend (BR-08).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const upstreamRes = await proxyAuthedApiRequest(
    req,
    `/candidate/assessments/${encodeURIComponent(id)}/timing`,
  );

  // Provide graceful fallback during local development when backend is offline
  if (upstreamRes.status === 503 && process.env.NODE_ENV !== 'production') {
    const now = Date.now();
    return NextResponse.json({
      assessmentId: id,
      assignmentId: id,
      serverTimeUtc: new Date(now).toISOString(),
      deadlineUtc: new Date(now + 90 * 60 * 1000).toISOString(),
      remainingMs: 90 * 60 * 1000,
      durationMinutes: 90,
      isExpired: false,
      pauseTimerOnDisconnect: false,
    });
  }

  return upstreamRes;
}
