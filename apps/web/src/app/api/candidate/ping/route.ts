import { NextResponse } from 'next/server';

/**
 * BFF Endpoint: GET /api/candidate/ping
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    timestamp: Date.now(),
  });
}
