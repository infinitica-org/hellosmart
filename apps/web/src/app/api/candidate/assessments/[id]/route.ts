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
  return proxyAuthedApiRequest(req, `/candidate/assessments/${encodeURIComponent(id)}`);
}
