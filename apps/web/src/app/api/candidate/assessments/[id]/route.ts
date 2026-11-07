import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Endpoint: GET /api/candidate/assessments/:id
 * Proxies to backend GET /api/v1/candidate/assessments/:id (BR-01, BR-08, BR-12).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const upstreamRes = await proxyAuthedApiRequest(
    req,
    `/candidate/assessments/${encodeURIComponent(id)}`,
  );

  // Provide graceful fallback during local development when backend is offline
  if (upstreamRes.status === 503 && process.env.NODE_ENV !== 'production') {
    return NextResponse.json({
      id,
      assignmentId: id,
      name: 'Full-Stack Distributed Systems Assessment',
      companyName: 'Acme Corporation',
      durationMinutes: 90,
      workspaceMode: 'cloud',
      status: 'ready',
      instructions: '# Instructions\n\nComplete the simulation tasks in the cloud workspace.',
      scenario: 'You are tasked with debugging and extending a distributed microservices architecture.',
      deliverables: ['Repository code', 'Architecture documentation'],
      aiPolicy: {
        enabled: true,
        allowedModels: ['gpt-4o', 'claude-3-5-sonnet'],
        capPerCandidate: { unit: 'tokens', value: 100000 },
        rpm: 30,
      },
      windowStartUtc: null,
      windowEndUtc: null,
    });
  }

  return upstreamRes;
}
