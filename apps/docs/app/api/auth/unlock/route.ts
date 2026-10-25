import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, TEAM_ROLES } from '@/lib/auth';
import { verifyPasswordServer } from '@/lib/auth.server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Please enter your access passkey.' },
        { status: 400 }
      );
    }

    const authResult = verifyPasswordServer(password);

    if (!authResult) {
      return NextResponse.json(
        { error: 'Invalid passkey. Access denied.' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      role: authResult.role,
      roleConfig: TEAM_ROLES[authResult.role],
      redirectTo: authResult.defaultRedirect,
    });

    response.cookies.set(AUTH_COOKIE_NAME, authResult.role, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Authentication failed due to an internal error.' },
      { status: 500 }
    );
  }
}
