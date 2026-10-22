Build the Next.js page for route $ARGUMENTS following `apps/web/CLAUDE.md`.

- `@hs/ui` components only; no ad-hoc styling systems.
- Data via the typed API client from `@hs/contracts` (works against the mock server on :4010).
- Server components by default; no secrets or privileged data in client bundles.
- Accessible: labels, focus order, keyboard, contrast (WCAG 2.2 AA target).
- Add a Playwright spec in `tests/e2e/specs/` for the main flow.
