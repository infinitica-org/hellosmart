import { NextRequest, NextResponse } from 'next/server';
import type { UploadedArtifactMetadata } from '@hs/contracts';

export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 52428800; // 50 MB
const ALLOWED_EXTENSIONS = ['.zip', '.tar', '.gz', '.tgz'];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: 'INVALID_FORM_DATA', message: 'No multipart data provided' },
        { status: 400 }
      );
    }

    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'FILE_MISSING', message: 'File is required' },
        { status: 400 }
      );
    }

    const fileName = (file as File).name || 'deliverable.zip';
    const fileSize = file.size;

    // Validate file size (Max 50 MB)
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'FILE_TOO_LARGE',
          message: `File exceeds maximum allowed size of 50 MB (${fileSize} bytes)`,
        },
        { status: 400 }
      );
    }

    // Validate file extension
    const lowerName = fileName.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    if (!hasValidExt) {
      return NextResponse.json(
        {
          error: 'UNSUPPORTED_FILE_TYPE',
          message: 'Only .zip, .tar, .tar.gz, and .tgz archives are supported',
        },
        { status: 400 }
      );
    }

    const sessionCookie = req.cookies.get('hs_session')?.value;
    const authHeader = req.headers.get('authorization');

    const apiBaseUrl =
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:4000/api/v1';

    const backendUrl = `${apiBaseUrl}/candidate/artifacts/upload`;

    try {
      // Forward stream to backend artifact store
      const backendRes = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          ...(sessionCookie ? { Cookie: `hs_session=${sessionCookie}` } : {}),
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: formData,
      });

      if (!backendRes.ok) {
        if (
          (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
          backendRes.status === 404
        ) {
          const artifactId = `art_${crypto.randomUUID()}`;
          const metadata: UploadedArtifactMetadata = {
            id: artifactId,
            originalName: fileName,
            mimeType: file.type || 'application/zip',
            sizeBytes: fileSize,
            downloadUrl: `/api/candidate/artifacts/${artifactId}/download`,
            uploadedAt: new Date().toISOString(),
          };
          return NextResponse.json(metadata, { status: 200 });
        }

        const errJson = await backendRes.json().catch(() => null);
        return NextResponse.json(
          {
            error: errJson?.code || 'UPLOAD_FAILED',
            message: errJson?.message || `Storage upload failed (${backendRes.status})`,
          },
          { status: backendRes.status }
        );
      }

      const backendData = await backendRes.json();
      return NextResponse.json(backendData, { status: 200 });
    } catch (fetchErr: unknown) {
      if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
        const artifactId = `art_${crypto.randomUUID()}`;
        const metadata: UploadedArtifactMetadata = {
          id: artifactId,
          originalName: fileName,
          mimeType: file.type || 'application/zip',
          sizeBytes: fileSize,
          downloadUrl: `/api/candidate/artifacts/${artifactId}/download`,
          uploadedAt: new Date().toISOString(),
        };
        return NextResponse.json(metadata, { status: 200 });
      }

      const detail = fetchErr instanceof Error ? fetchErr.message : 'Backend unreachable';
      return NextResponse.json(
        { error: 'STORAGE_UNAVAILABLE', message: detail },
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

