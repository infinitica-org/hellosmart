import { NextRequest, NextResponse } from 'next/server';
import { assessmentConsentSchema, CURRENT_CONSENT_TEXT_VERSION } from '@hs/contracts';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);

    const parseResult = assessmentConsentSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'INVALID_REQUEST',
          message: 'Invalid consent submission data',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { assessmentId, textVersion } = parseResult.data;

    // Verify text version matches current active legal policy
    if (textVersion !== CURRENT_CONSENT_TEXT_VERSION) {
      return NextResponse.json(
        {
          error: 'STALE_CONSENT_VERSION',
          message: `The consent agreement has been updated. Please review and accept policy ${CURRENT_CONSENT_TEXT_VERSION}.`,
        },
        { status: 409 }
      );
    }

    // Extract client IP and User-Agent from trusted server request headers
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0]?.trim() : '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // Retrieve session cookie to authenticate the candidate
    const sessionCookie = req.cookies.get('hs_session')?.value;
    const authHeader = req.headers.get('authorization');

    const apiBaseUrl =
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:4000/api/v1';

    const backendUrl = `${apiBaseUrl}/candidate/assessment/consent`;

    try {
      const backendRes = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(sessionCookie ? { Cookie: `hs_session=${sessionCookie}` } : {}),
          ...(authHeader ? { Authorization: authHeader } : {}),
          'X-Forwarded-For': clientIp || '127.0.0.1',
          'User-Agent': userAgent,
        },
        body: JSON.stringify({
          assessmentId,
          textVersion,
        }),
      });

      if (!backendRes.ok) {
        // In local development, if backend consent API is not yet implemented (404), return dev confirmation
        if (
          (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
          backendRes.status === 404
        ) {
          return NextResponse.json(
            {
              success: true,
              consentId: `csnt_dev_${crypto.randomUUID()}`,
              assessmentId,
              textVersion,
              acceptedAt: new Date().toISOString(),
            },
            { status: 200 }
          );
        }

        const errJson = await backendRes.json().catch(() => null);
        const errorMessage =
          errJson?.message ||
          errJson?.detail ||
          `Backend failed to record consent (${backendRes.status})`;

        return NextResponse.json(
          {
            error: errJson?.code || 'CONSENT_RECORD_FAILED',
            message: errorMessage,
          },
          { status: backendRes.status }
        );
      }

      const backendData = await backendRes.json();
      return NextResponse.json(backendData, { status: 200 });
    } catch (fetchErr: unknown) {
      // In local development when backend is offline, return dev confirmation for UI testing
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        return NextResponse.json(
          {
            success: true,
            consentId: `csnt_dev_${crypto.randomUUID()}`,
            assessmentId,
            textVersion,
            acceptedAt: new Date().toISOString(),
          },
          { status: 200 }
        );
      }

      // Rule: In production, never fake success without durable backend persistence
      const errorDetail = fetchErr instanceof Error ? fetchErr.message : 'Backend connection error';
      return NextResponse.json(
        {
          error: 'BACKEND_UNAVAILABLE',
          message: `Unable to securely record consent with platform servers: ${errorDetail}. Please try again.`,
        },
        { status: 503 }
      );
    }
  } catch (error: unknown) {
    const errorDetail = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      {
        error: 'INTERNAL_ERROR',
        message: `Failed to process consent submission: ${errorDetail}`,
      },
      { status: 500 }
    );
  }
}

