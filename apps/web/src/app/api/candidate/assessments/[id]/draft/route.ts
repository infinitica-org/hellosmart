import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Endpoint: GET /api/candidate/assessments/:id/draft
 * Proxies candidate draft loading to backend (BR-11).
 */
export async function GET(
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
      assessmentId: id,
      repositoryUrl: '',
      branchName: 'main',
      uploadedArtifact: null,
      architectureNotes: '',
      version: 0,
      savedAt: new Date().toISOString(),
    });
  }

  return upstreamRes;
}

/**
 * BFF Endpoint: POST /api/candidate/assessments/:id/draft
 * Alias route proxying candidate workspace drafts to backend (BR-11).
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
