import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const backendBase =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000/api/v1';

  const cookieHeader = req.headers.get('cookie') || '';
  const authorizationHeader = req.headers.get('authorization') || '';

  try {
    const backendRes = await fetch(`${backendBase}/candidate/assignments`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(authorizationHeader ? { authorization: authorizationHeader } : {}),
      },
      cache: 'no-store',
    });

    const status = backendRes.status;
    const data = await backendRes.json().catch(() => null);

    if (!backendRes.ok) {
      if (backendRes.status === 404) {
        return NextResponse.json([], { status: 200 });
      }

      return NextResponse.json(
        data || { title: 'Failed to retrieve assignments', status },
        { status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (_error: unknown) {
    // If backend is offline or not yet connected, return empty list to display empty state
    return NextResponse.json([], { status: 200 });
  }
}


