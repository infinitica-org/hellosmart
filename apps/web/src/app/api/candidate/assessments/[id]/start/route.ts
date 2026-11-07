import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Endpoint: POST /api/candidate/assessments/:id/start
 * Proxies assessment starting / workspace ticket generation to backend (BR-08).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const upstreamRes = await proxyAuthedApiRequest(
    req,
    `/candidate/assessments/${encodeURIComponent(id)}/start`,
  );

  // Provide graceful fallback during local development when backend is offline
  if (upstreamRes.status === 503 && process.env.NODE_ENV !== 'production') {
    const now = Date.now();
    return NextResponse.json({
      sessionId: `sess-dev-${id}`,
      assignmentId: id,
      mode: 'cloud',
      status: 'ready',
      gatewayUrl: 'ws://localhost:4000/ws/terminal',
      ticket: `ticket-dev-${id}`,
      serverTimeUtc: new Date(now).toISOString(),
      deadlineUtc: new Date(now + 90 * 60 * 1000).toISOString(),
      remainingMs: 90 * 60 * 1000,
      requireFullscreen: false,
    });
  }

  return upstreamRes;
}
