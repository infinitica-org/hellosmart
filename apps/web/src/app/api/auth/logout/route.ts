import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sessionToken = req.cookies.get('hs_session')?.value;
  const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:4000';

  if (sessionToken) {
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: {
          Cookie: `hs_session=${sessionToken}`,
          Authorization: `Bearer ${sessionToken}`,
        },
      });
    } catch {
      // ignore network errors on logout
    }
  }

  const res = NextResponse.json({ success: true }, { status: 200 });
  res.cookies.delete('hs_session');
  res.cookies.delete('hs_role');
  return res;
}
