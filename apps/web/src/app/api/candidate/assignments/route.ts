import { NextRequest, NextResponse } from 'next/server';

/**
 * Development test fixtures representing all 5 candidate assessment statuses.
 * Only returned in development mode when the backend assignments endpoint is not yet implemented (404)
 * or when the backend server is unreachable.
 */
const DEV_CANDIDATE_FIXTURES = [
  {
    id: 'asm-ready-001',
    title: 'Senior Full Stack Engineer Assessment',
    companyName: 'Aster Ridge Technologies',
    durationMinutes: 90,
    status: 'ready' as const,
    windowStartUtc: null,
    windowEndUtc: new Date(Date.now() + 86400000 * 5).toISOString(),
    workspaceMode: 'cloud' as const,
  },
  {
    id: 'asm-upcoming-002',
    title: 'Distributed Systems Architecture',
    companyName: 'CloudScale Infrastructure',
    durationMinutes: 120,
    status: 'window_not_open' as const,
    windowStartUtc: new Date(Date.now() + 86400000 * 2 + 3600000 * 8 + 60000 * 35).toISOString(),
    windowEndUtc: new Date(Date.now() + 86400000 * 6).toISOString(),
    workspaceMode: 'cloud' as const,
  },
  {
    id: 'asm-progress-003',
    title: 'API Security & Telemetry Simulation',
    companyName: 'CyberGuard Global',
    durationMinutes: 60,
    status: 'in_progress' as const,
    workspaceMode: 'cloud' as const,
    workspaceId: 'ws-active-777',
  },
  {
    id: 'asm-submitted-004',
    title: 'Data Engineering Pipeline Evaluation',
    companyName: 'FinTech Solutions',
    durationMinutes: 45,
    status: 'submitted' as const,
    submittedAt: new Date(Date.now() - 86400000).toISOString(),
    workspaceMode: 'chat' as const,
  },
  {
    id: 'asm-expired-005',
    title: 'Legacy Systems Migration Assessment',
    companyName: 'Enterprise Corp',
    durationMinutes: 60,
    status: 'expired' as const,
    windowEndUtc: new Date(Date.now() - 3600000 * 12).toISOString(),
    workspaceMode: 'cloud' as const,
  },
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const isDevOrTest =
    process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

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
      // In development, if backend has not yet implemented this route (404), return development fixtures
      if (isDevOrTest && backendRes.status === 404) {
        return NextResponse.json(DEV_CANDIDATE_FIXTURES, { status: 200 });
      }

      return NextResponse.json(
        data || { title: 'Failed to retrieve assignments', status },
        { status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: unknown) {
    // If backend server is offline in local dev mode, return fixtures for UI testing
    if (isDevOrTest) {
      return NextResponse.json(DEV_CANDIDATE_FIXTURES, { status: 200 });
    }

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

