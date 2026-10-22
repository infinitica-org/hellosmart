# apps/web: Next.js (Company & Admin dept; `(candidate)` owned by Candidate & Workspace)

App Router with route groups: `(landing)`, `(auth)`, `(company)`, `(candidate)`, `(admin)`. One master login at `/login`; `middleware.ts` routes by role from `/me` (CO-004, BR-25).

## Rules
- Server components by default; client components only for interaction.
- Data via the typed client generated from `@hs/contracts`. Point `API_BASE_URL` at the mock (:4010) until the real endpoint exists.
- UI from `@hs/ui` only.
- **Security:** strict CSP with per-request nonce (set in `middleware.ts`), no `dangerouslySetInnerHTML` (lint error), no secrets in `NEXT_PUBLIC_*`, session cookie is HttpOnly so JS never sees it, CSRF token header on mutations.
- Candidate content (briefs, transcripts, files) is rendered as text or sanitized markdown (rehype-sanitize), never raw HTML.
- Route-group layouts re-check role server-side; UI hiding is cosmetic.
- "Powered by hellosmart.ai" is rendered by the shared `BrandMark` and hidden only when `/me` reports the white-label entitlement (BR-28).
- Accessibility: labels, focus states, keyboard paths; Playwright + axe in e2e.
