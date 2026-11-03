import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const assessmentId = searchParams.get('id') || searchParams.get('assessmentId');

  if (!assessmentId) {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Missing required assessment ID' },
      { status: 400 }
    );
  }

  const backendBase =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000/api/v1';

  const cookieHeader = req.headers.get('cookie') || '';
  const authorizationHeader = req.headers.get('authorization') || '';

  try {
    // 1. Attempt to fetch specific assessment/assignment details from backend
    const backendRes = await fetch(`${backendBase}/candidate/assessments/${encodeURIComponent(assessmentId)}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(authorizationHeader ? { authorization: authorizationHeader } : {}),
      },
      cache: 'no-store',
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      return NextResponse.json(data, { status: 200 });
    }

    // 2. Try fetching from assignments list if single-item endpoint is not separate
    const listRes = await fetch(`${backendBase}/candidate/assignments`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(authorizationHeader ? { authorization: authorizationHeader } : {}),
      },
      cache: 'no-store',
    });

    if (listRes.ok) {
      const listData = await listRes.json();
      const items = Array.isArray(listData) ? listData : listData?.items || listData?.data || [];
      const found = items.find((item: any) => item.id === assessmentId || item.workspaceId === assessmentId);
      if (found) {
        return NextResponse.json(found, { status: 200 });
      }
    }

    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'Assessment not found' },
      { status: 404 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Backend unreachable';
    return NextResponse.json(
      { error: 'SERVICE_UNAVAILABLE', message },
      { status: 503 }
    );
  }
}

