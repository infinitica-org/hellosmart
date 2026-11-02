import { NextRequest, NextResponse } from 'next/server';
import { CandidateDraftSchema, type CandidateDraft } from '@hs/contracts';

export const dynamic = 'force-dynamic';

// In-memory development store for draft persistence across page reloads when backend draft endpoint is not yet connected
const devDraftStore = new Map<string, CandidateDraft>();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const assessmentId = searchParams.get('assessmentId') || 'asm-ready-001';

    const sessionCookie = req.cookies.get('hs_session')?.value;
    const authHeader = req.headers.get('authorization');

    const apiBaseUrl =
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:4000/api/v1';

    const backendUrl = `${apiBaseUrl}/candidate/assessment/draft?assessmentId=${encodeURIComponent(assessmentId)}`;

    try {
      const backendRes = await fetch(backendUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(sessionCookie ? { Cookie: `hs_session=${sessionCookie}` } : {}),
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        cache: 'no-store',
      });

      if (!backendRes.ok) {
        if (
          (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
          backendRes.status === 404
        ) {
          const stored = devDraftStore.get(assessmentId) || {
            assessmentId,
            repositoryUrl: '',
            branchName: 'main',
            uploadedArtifact: null,
            architectureNotes: '',
            version: 0,
            updatedAt: new Date().toISOString(),
          };
          return NextResponse.json(stored, { status: 200 });
        }

        const errJson = await backendRes.json().catch(() => null);
        return NextResponse.json(
          {
            error: errJson?.code || 'DRAFT_LOAD_FAILED',
            message: errJson?.message || `Failed to fetch draft (${backendRes.status})`,
          },
          { status: backendRes.status }
        );
      }

      const backendData = await backendRes.json();
      return NextResponse.json(backendData, { status: 200 });
    } catch (fetchErr: unknown) {
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        const stored = devDraftStore.get(assessmentId) || {
          assessmentId,
          repositoryUrl: '',
          branchName: 'main',
          uploadedArtifact: null,
          architectureNotes: '',
          version: 0,
          updatedAt: new Date().toISOString(),
        };
        return NextResponse.json(stored, { status: 200 });
      }

      const detail = fetchErr instanceof Error ? fetchErr.message : 'Backend unreachable';
      return NextResponse.json(
        { error: 'DRAFT_SERVICE_UNAVAILABLE', message: detail },
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

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);
    const parseResult = CandidateDraftSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'INVALID_DRAFT_PAYLOAD',
          message: 'Draft payload validation failed',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const draft = parseResult.data;
    const sessionCookie = req.cookies.get('hs_session')?.value;
    const authHeader = req.headers.get('authorization');

    const apiBaseUrl =
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:4000/api/v1';

    const backendUrl = `${apiBaseUrl}/candidate/assessment/draft`;

    try {
      const backendRes = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(sessionCookie ? { Cookie: `hs_session=${sessionCookie}` } : {}),
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(draft),
      });

      if (!backendRes.ok) {
        if (
          (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
          backendRes.status === 404
        ) {
          const updatedDraft: CandidateDraft = {
            ...draft,
            version: (draft.version || 0) + 1,
            updatedAt: new Date().toISOString(),
          };
          devDraftStore.set(draft.assessmentId, updatedDraft);
          return NextResponse.json(
            {
              success: true,
              version: updatedDraft.version,
              updatedAt: updatedDraft.updatedAt,
            },
            { status: 200 }
          );
        }

        const errJson = await backendRes.json().catch(() => null);
        return NextResponse.json(
          {
            error: errJson?.code || 'DRAFT_SAVE_FAILED',
            message: errJson?.message || `Failed to save draft (${backendRes.status})`,
          },
          { status: backendRes.status }
        );
      }

      const backendData = await backendRes.json();
      return NextResponse.json(backendData, { status: 200 });
    } catch (fetchErr: unknown) {
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        const updatedDraft: CandidateDraft = {
          ...draft,
          version: (draft.version || 0) + 1,
          updatedAt: new Date().toISOString(),
        };
        devDraftStore.set(draft.assessmentId, updatedDraft);
        return NextResponse.json(
          {
            success: true,
            version: updatedDraft.version,
            updatedAt: updatedDraft.updatedAt,
          },
          { status: 200 }
        );
      }

      const detail = fetchErr instanceof Error ? fetchErr.message : 'Backend unreachable';
      return NextResponse.json(
        { error: 'DRAFT_SERVICE_UNAVAILABLE', message: detail },
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

