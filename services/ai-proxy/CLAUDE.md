# services/ai-proxy (AI Engineering · sensitive path: Architecture approval required)

FastAPI, streaming. Exposes Anthropic-compatible and OpenAI-compatible endpoints so Claude Code / Codex inside workspaces work unmodified with `ANTHROPIC_BASE_URL` / `OPENAI_BASE_URL` pointed here.

## Non-negotiables
- Provider keys come from Secrets Manager at call time (5-min in-memory cache). Never in env vars of workspaces, logs, responses, exceptions or traces.
- structlog processor redacts headers `authorization`, `x-api-key`, and any value matching key patterns.
- Caps and RPM are checked **and** reserved atomically in Redis (Lua) before forwarding; reconciled with actual tokens after.
- 80% cap → warning header `x-hs-budget-warning`; 100% → 402 with problem+json `code: AI_CAP_REACHED`.
- AI OFF or model not allowlisted → 403 `code: AI_POLICY_DENIED`.
- Every request/response persisted (S3 transcript ref + `ai_usage_events` row) with org + workspace scope.
- Outbound only to the provider allowlist (api.anthropic.com, api.openai.com, bedrock-runtime.ap-south-1.amazonaws.com).

## Tests
Token tampering, wrong audience, expired, cross-workspace reuse, revoked; cap races (concurrent requests); key never appears in captured logs (assert on log sink).
