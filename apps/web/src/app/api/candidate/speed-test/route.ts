import { NextRequest, NextResponse } from 'next/server';

/**
 * BFF Endpoint: GET /api/candidate/speed-test
 * Used for network latency ping and download speed measurement fallback.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const requestedBytes = parseInt(searchParams.get('bytes') || '2000000', 10);
  
  // Bound payload size between 10 KB and 5 MB
  const size = Math.max(10240, Math.min(requestedBytes, 5242880));

  // Generate lightweight deterministic binary payload buffer
  const chunk = new Uint8Array(size);
  // Fill first few bytes to ensure valid memory allocation
  chunk.fill(65);

  return new Response(chunk, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': size.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    },
  });
}

/**
 * BFF Endpoint: HEAD /api/candidate/speed-test
 * Used for ultra-low overhead latency ping check (zero body transfer).
 */
export async function HEAD(): Promise<Response> {
  return new Response(null, {
    status: 200,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': '0',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
