import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Endpoint: POST /api/candidate/workspace/:id/heartbeat
 * Proxies candidate workspace activity heartbeat to backend (I174, BR-08, BR-11).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!id || typeof id !== 'string' || !id.trim()) {
    return NextResponse.json(
      {
        title: 'Bad Request',
        status: 400,
        detail: 'Workspace ID parameter is required',
        code: 'INVALID_WORKSPACE_ID',
      },
      { status: 400 },
    );
  }

  const upstreamRes = await proxyAuthedApiRequest(
    req,
    `/candidate/workspace/${encodeURIComponent(id.trim())}/heartbeat`,
  );

  // Provide graceful fallback during local development when backend is offline
  if (upstreamRes.status === 503 && process.env.NODE_ENV !== 'production') {
    return NextResponse.json({
      success: true,
      recordedAt: new Date().toISOString(),
    });
  }

  return upstreamRes;
}
