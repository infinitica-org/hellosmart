import { NextRequest, NextResponse } from 'next/server';
import { proxyAuthedApiRequest } from '@/lib/auth-bff-proxy';

/**
 * BFF Endpoint: GET /api/candidate/assessments
 * Proxies to backend GET /api/v1/candidate/assessments (BR-01, BR-25).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  return proxyAuthedApiRequest(req, '/candidate/assessments');
}
