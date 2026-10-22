# 0004: Contract-first development with mocks and fakes

**Status:** Accepted · 2026-10-22

## Decision
OpenAPI, DB schema, event schema and UI route map live in `packages/contracts` and freeze on 30 Oct 2026. Frontend builds against the Prism mock; every external provider has a fake adapter; shared fixtures cover every state. A ticket may depend on a contract, never on another department's implementation.

## Consequences
+ No department blocks another; parallel AI agents have an unambiguous target.
− Contract mistakes are expensive; Architecture reviews contract PRs within 4 working hours.
