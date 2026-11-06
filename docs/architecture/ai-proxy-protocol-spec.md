# HelloSmart Controlled AI Proxy Protocol Specification (v1)

**Target Invariants:** BR-13, BR-14, BR-15, BR-16, BR-17  
**Author:** Tino Britty J (System Architect & Team Lead)  
**Status:** Approved Architectural Contract  
**Listening Port:** `4000` (Internal Mesh / Localhost)  

---

## 1. Overview & Security Invariants
The HelloSmart AI Proxy is the **single and exclusive network egress route** for all LLM calls originating from candidate workspaces or virtual assistant machines.

1. **Zero Key Leakage (BR-13, BR-16)**: Workspaces hold only a short-lived session JWT (`hs_ws_...`). Workspaces never receive real provider keys (OpenAI, Anthropic, OpenRouter).
2. **AI Policy Enforcement (BR-14)**: When AI is configured `OFF`, the proxy rejects all completions requests with `403 Forbidden`, and egress firewalls drop outbound traffic to AI endpoints.
3. **Budget Caps (BR-15)**: Per-candidate and per-assessment token and cost ceilings are tracked in Redis. Reaching 80% triggers a warning header; reaching 100% halts requests with RFC 7807 `429 Too Many Requests`.
4. **Tamper-Evident Evidence Logging (BR-18)**: Every prompt and response is logged with tokens and costs to the database for reviewer agent evaluation.

---

## 2. Authentication Handshake & Token Lifecycle

```
[Candidate Workspace Container]
       |
       | 1. POST /v1/chat/completions
       |    Authorization: Bearer hs_ws_session_jwt
       v
[AI Proxy Gateway :4000]
       |
       |-- 2. Verify JWT signature & expiration (15-min TTL)
       |-- 3. Extract claims: { candidateId, orgId, assessmentId, sessionId }
       |-- 4. Check assessment policy: AI enabled? Model in allowlist?
       |-- 5. Sliding-window RPM check (< 30 req/min)
       |-- 6. Token budget check: cumulative_spend < cap_usd?
       |
       | 7. Resolve provider secret from HashiCorp Vault / AWS KMS
       v
[External LLM Provider (Anthropic / OpenAI)]
```

### JWT Claims Schema
```json
{
  "iss": "hellosmart-fabric-control-plane",
  "sub": "cand_9f81a7b2-3c1d-4e5f-b6a7-890123456789",
  "org_id": "org_550e8400-e29b-41d4-a716-446655440000",
  "assessment_id": "asm_12345678-1234-1234-1234-123456789012",
  "session_id": "ses_abcdef01-2345-6789-abcd-ef0123456789",
  "allowed_models": ["claude-3-5-sonnet", "gpt-4o"],
  "exp": 1793645000,
  "iat": 1793644100
}
```

---

## 3. Sliding-Window RPM & Budget Algorithms

### Sliding-Window RPM Counter (Redis Sorted Sets)
- Key: `hs:{env}:ai:rpm:{sessionId}`
- Logic:
  1. `ZREMRANGEBYSCORE key -inf (now - 60)` (purge entries older than 60 seconds)
  2. `ZCARD key` (count requests in the last minute)
  3. If count $\ge \text{RPM\_LIMIT}$, return HTTP `429 Too Many Requests`.
  4. `ZADD key now requestId` and `EXPIRE key 120`.

### Cumulative Token & Cost Budget Enforcement
- Redis Hash: `hs:{env}:ai:spend:{sessionId}`
  - Fields: `total_tokens_in`, `total_tokens_out`, `total_cost_usd`
- Invariant:
  $$\text{total\_cost\_usd} \le \text{budget\_usd}$$
- When $\frac{\text{total\_cost\_usd}}{\text{budget\_usd}} \ge 0.80$: Emit header `X-HelloSmart-Budget-Remaining: <cents>` and warning banner.
- When $\text{total\_cost\_usd} \ge \text{budget\_usd}$: Immediately reject request with RFC 7807 problem details:

```json
{
  "type": "https://hellosmart.ai/errors/ai-budget-exceeded",
  "title": "AI Token Budget Exceeded",
  "status": 429,
  "detail": "Your assessment AI budget of $2.00 has been reached. Further AI completions are disabled.",
  "code": "AI_BUDGET_EXCEEDED",
  "budget_limit_usd": 2.00,
  "current_spend_usd": 2.00
}
```

---

## 4. Provider Key Resolution (Vault KMS)
The AI Proxy fetches the decrypted tenant or platform provider key from the internal vault service inside memory buffers only. Plaintext keys are **never** logged to stdout, persisted to disk, or transmitted to client workspaces.
