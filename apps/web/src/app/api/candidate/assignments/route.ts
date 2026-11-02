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
      return NextResponse.json(
        data || { title: 'Failed to retrieve assignments', status },
        { status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Backend unreachable';
    return NextResponse.json(
      {
        title: 'Backend service unavailable',
        detail: message,
        status: 503,
      },
      { status: 503 }
    );
  }
}

