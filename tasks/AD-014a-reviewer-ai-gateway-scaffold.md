# AD-014a: Scaffold the reviewer AI gateway and versioned evidence schema

**Department:** AI Engineering · **Sprint:** · **Zoho item:** (none yet — sub-numbered off AD-014) · **Priority/Phase:** Must · MMP

## Requirement (verbatim from AGENTS.md)

> **AD-014** Maintain reviewer agent library `Must · MMP`
> *Acceptance:* Define agents (prompt/config, model, version, enabled flag); version and roll back.

This ticket is the first slice: before any agent can be defined against it, `services/reviewer` needs (1) a safe-starting AI-calling module (the "AI gateway") agents will route their model calls through, and (2) a versioned schema for the evidence bundle the evidence builder hands to agents (§4.3 step 1 of `docs/00-architecture-and-delivery-plan.md`).

## Acceptance criteria
- [x] AC1: `services/reviewer` starts (`/healthz` green) with zero network egress when `LLM_PROVIDER=fake` (matches repo-wide fake-adapter convention) — verified both via TestClient and a real `uv run uvicorn` boot + `curl`
- [x] AC2: `AIProviderAdapter` protocol + adapters for `openrouter`, `anthropic`, `gemini`, `fake` exist; each is independently health-checkable
- [x] AC3: Routing is model-agnostic: an agent's declared `model` (per AD-014's `agent.yaml`-equivalent config) is requested via OpenRouter first; same-model-direct adapter is the next fallback; cross-model substitution is the last resort and is never silent
- [x] AC4: Provider-selection failures (unreachable/circuit-open) and key/auth failures raise distinct exception types — never collapsed into one generic error
- [x] AC5: A cross-model substitution sets `flags: ["model_substituted"]` and hard-caps `confidence` on the resulting `AgentScore`
- [x] AC6: `EvidenceItem`/`EvidencePack` (v1) defined in Pydantic, extending the existing `ref` vocabulary (`term|diff|ai|file|event|test`) from `schemas.py`; JSON Schema exported to `services/reviewer/schemas/evidence.v1.schema.json` for team review. **Locked 2026-10-23** after confirming with Vedika (packages/fixtures seed-data work, which builds `submissions` fixtures directly against this schema per its README): no `org_id` on the evidence/score records (org is derived via submission → candidate → org lookup, never carried here), no separate `evidence_type`/`metadata` fields (folding that into `content` is sufficient for her fixtures).
- [x] AC7: Output contract documented (`services/reviewer/docs/output-contract.md`): `AgentScore` shape, ref/quote resolution rule, immutability (BR-20)
- [x] AC8: Grader keys resolved from Secrets Manager at call time, in-memory cache only; structlog redaction verified by test (key never appears in captured log sink)
- [x] AC9: Deterministic fake-adapter fixtures: baseline score, simulated circuit-open (forces fallback path), prompt-injection-in-evidence (score must not move)

All 9 verified under the repo's actual required command (`uv run pytest && uv run ruff check && uv run mypy .`): 22/22 tests pass, ruff clean, mypy strict clean (0 issues / 26 files).

## Business rules touched
BR-18 (independent agents, evidence-cited, sanitized input, adversarial suite), BR-20 (scores immutable, human-in-the-loop), BR-31 (audit — deferred to a follow-up ticket; this scaffold only emits the fields AD-015's dashboard will need: provider, model, latency, cost, retry count)

## Contract refs
- API operationIds: none (internal service module, no new HTTP surface)
- Tables / migrations: none
- Events: none

## Files in scope (this department only)
- `services/reviewer/app/gateway/` (new): `interface.py`, `errors.py`, `circuit_breaker.py`, `router.py`, `adapters/{openrouter,anthropic,gemini,fake}.py`
- `services/reviewer/app/evidence.py` (new)
- `services/reviewer/schemas/evidence.v1.schema.json` (generated)
- `services/reviewer/docs/output-contract.md` (new)
- `services/reviewer/app/main.py` (add `/healthz` wiring for the gateway's health check — additive only)
- `services/reviewer/tests/` (new)

Out of scope for this ticket: `services/ai-proxy` (separate actor, separate BR-13 path — untouched), `services/reviewer/app/sanitizer/` (existing, reused as-is, not modified), any real agent definition under `services/reviewer/agents/` beyond the existing reference `debugging-process.yaml`, `packages/contracts`.

## Test plan
| AC / BR | Test name | Type |
|---|---|---|
| AC1 | `test_healthz_zero_egress` | integration |
| AC3/AC4 | `test(BR-18): openrouter failure falls back to same-model direct adapter before cross-model` | unit |
| AC4 | `test(BR-18): auth failure raises ProviderAuthError, not ProviderUnavailableError` | unit |
| AC5 | `test(BR-20): cross-model substitution flags model_substituted and caps confidence` | unit |
| AC6 | `test_evidence_schema_json_export_matches_pydantic_model` | unit |
| AC8 | `test(BR-18): grader key never appears in captured log sink` | unit |
| AC9 | `test(BR-18): injected instruction in evidence content does not change fake-adapter score` | unit |

## Security notes
Grader keys separate from company/candidate keys (per `services/reviewer/CLAUDE.md`); no secrets in fixtures; candidate-authored evidence content routed through the existing `sanitizer.wrap_untrusted()` before ever reaching a prompt — this ticket's evidence schema marks `untrusted: bool` per item but does not change the sanitizer itself.

## Out of scope
Real provider credentials/wiring beyond `.env.example` placeholders; golden-set evals (nightly CI job, separate ticket); `services/reviewer/app/sanitizer/` changes (architecture-owned path); any agent going to `status: active`.

## Approved by (dept lead) / date
_pending_
