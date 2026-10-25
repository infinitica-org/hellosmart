import { NextRequest, NextResponse } from 'next/server';
import { isMarkdownPreferred, rewritePath } from 'fumadocs-core/negotiation';
import { docsContentRoute, docsRoute } from '@/lib/shared';
import { AUTH_COOKIE_NAME, TEAM_ROLES, TeamRole } from '@/lib/auth';

const { rewrite: rewriteDocs } = rewritePath(
  `${docsRoute}{/*path}`,
  `${docsContentRoute}{/*path}/content.md`,
);
const { rewrite: rewriteSuffix } = rewritePath(
  `${docsRoute}{/*path}.md`,
  `${docsContentRoute}{/*path}/content.md`,
);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Allow public routes without authentication
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/unlock' ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml';

  if (!isPublic) {
    const roleCookie = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const isValid = roleCookie && TEAM_ROLES[roleCookie as TeamRole];

    if (!isValid) {
      const unlockUrl = new URL('/unlock', request.url);
      if (pathname !== '/' && !pathname.startsWith('/api/')) {
        unlockUrl.searchParams.set('returnTo', pathname);
      }
      return NextResponse.redirect(unlockUrl);
    }
  }

  // 2. Fumadocs Content Negotiation
  const result = rewriteSuffix(pathname);
  if (result) {
    return NextResponse.rewrite(new URL(result, request.nextUrl));
  }

  if (isMarkdownPreferred(request)) {
    const resultDocs = rewriteDocs(pathname);
    if (resultDocs) {
      return NextResponse.rewrite(new URL(resultDocs, request.nextUrl), {
        headers: { Vary: 'Accept' },
      });
    }
  }

  return NextResponse.next();
}
