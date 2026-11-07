import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Endpoint: GET /api/candidate/assessments
 * Proxies to backend GET /api/v1/candidate/assessments (BR-01, BR-25).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const upstreamRes = await proxyAuthedApiRequest(req, '/candidate/assessments');

  // Provide graceful fallback during local development when backend is offline
  if (upstreamRes.status === 503 && process.env.NODE_ENV !== 'production') {
    return NextResponse.json([
      {
        id: 'e3ad6522-9a88-50a0-b828-8c5c7b6a2968',
        assessmentId: 'asm-dev-simulation',
        title: 'Full-Stack Distributed Systems Assessment',
        companyName: 'Acme Corporation',
        workspaceMode: 'cloud',
        status: 'ready',
        durationMinutes: 90,
        deadline: null,
        submittedAt: null,
        releaseResults: false,
      },
    ]);
  }

  return upstreamRes;
}
