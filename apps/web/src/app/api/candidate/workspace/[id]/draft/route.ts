import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Endpoint: POST /api/candidate/workspace/:id/draft
 * Proxies continuous workspace autosave drafts to backend (BR-11).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const upstreamRes = await proxyAuthedApiRequest(
    req,
    `/candidate/workspace/${encodeURIComponent(id)}/draft`,
  );

  // Provide graceful fallback during local development when backend is offline
  if (upstreamRes.status === 503 && process.env.NODE_ENV !== 'production') {
    return NextResponse.json({
      success: true,
      savedAt: new Date().toISOString(),
    });
  }

  return upstreamRes;
}
