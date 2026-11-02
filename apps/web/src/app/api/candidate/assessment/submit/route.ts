import { NextRequest, NextResponse } from 'next/server';
import { SubmitAssessmentDtoSchema, type SubmitAssessmentResponse } from '@hs/contracts';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);
    const parseResult = SubmitAssessmentDtoSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'INVALID_SUBMISSION_PAYLOAD',
          message: 'Submission validation failed',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const submissionDto = parseResult.data;
    const sessionCookie = req.cookies.get('hs_session')?.value;
    const authHeader = req.headers.get('authorization');

    const apiBaseUrl =
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:4000/api/v1';

    const backendUrl = `${apiBaseUrl}/candidate/assessment/submit`;

    try {
      const backendRes = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(sessionCookie ? { Cookie: `hs_session=${sessionCookie}` } : {}),
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(submissionDto),
      });

      if (!backendRes.ok) {
        if (
          (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
          backendRes.status === 404
        ) {
          const submissionId = `sub_${crypto.randomUUID()}`;
          const receiptId = `rcpt_${Math.floor(100000 + Math.random() * 900000)}`;
          const response: SubmitAssessmentResponse = {
            success: true,
            submissionId,
            assessmentId: submissionDto.assessmentId,
            receiptId,
            submittedAt: new Date().toISOString(),
          };
          return NextResponse.json(response, { status: 200 });
        }

        const errJson = await backendRes.json().catch(() => null);
        return NextResponse.json(
          {
            error: errJson?.code || 'SUBMISSION_FAILED',
            message: errJson?.message || `Failed to submit assessment (${backendRes.status})`,
          },
          { status: backendRes.status }
        );
      }

      const backendData = await backendRes.json();
      return NextResponse.json(backendData, { status: 200 });
    } catch (fetchErr: unknown) {
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        const submissionId = `sub_${crypto.randomUUID()}`;
        const receiptId = `rcpt_${Math.floor(100000 + Math.random() * 900000)}`;
        const response: SubmitAssessmentResponse = {
          success: true,
          submissionId,
          assessmentId: submissionDto.assessmentId,
          receiptId,
          submittedAt: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 200 });
      }

      const detail = fetchErr instanceof Error ? fetchErr.message : 'Backend unreachable';
      return NextResponse.json(
        { error: 'SUBMISSION_SERVICE_UNAVAILABLE', message: detail },
        { status: 503 }
      );
    }
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: detail },
      { status: 500 }
    );
  }
}

