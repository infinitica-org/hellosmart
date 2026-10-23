# Reviewer output contract

Scope: what `services/reviewer` emits per agent run. The *input* side
(evidence bundle) is `app/evidence.py` / `schemas/evidence.v1.schema.json`
(AD-014a). This doc covers the *output* side, which already existed before
this ticket (`app/schemas.py`) and is restated here for team review
alongside the new evidence schema, unchanged.

## Shape

```python
class Evidence(BaseModel):
    ref: str      # must match ^(term|diff|ai|file|event|test):[\w./#:\-]{1,200}$
    quote: str    # <= 500 chars, must be an exact substring of that ref's EvidenceItem.content

class AgentScore(BaseModel):
    rubric_item_id: str
    score: float | None   # None only for flag-only agents (e.g. integrity observer)
    confidence: float     # 0..1
    rationale: str        # <= 4000 chars
    evidence: list[Evidence]   # non-empty — enforced by a field_validator
    flags: list[str] = []
```

This matches `docs/00-architecture-and-delivery-plan.md` §4.1's documented
agent output: `{score, confidence, rationale, evidence: [{ref, quote}], flags}`.

## Rules (BR-18, BR-20)

- **Evidence is mandatory.** `AgentScore.evidence_required` rejects a score
  with no evidence at all. A ref that doesn't resolve in the evidence pack,
  or a quote that isn't an exact substring of that item's content, is the
  validator's job (pipeline step 4, §4.3) — not this schema's — and results
  in one retry, then the dimension is marked `missing`.
- **Scores are immutable once written (BR-20).** `services/reviewer`
  never overwrites a persisted `AgentScore`; a re-run (`AD-016`, Phase 2)
  creates a new one, it does not mutate the original. Humans override and
  finalize in `apps/api`'s review module, not here.
- **`flags: ["model_substituted"]`** (new in AD-014a) means the gateway
  (`app/gateway/router.py`) could not reach any adapter that natively
  serves the agent's pinned model and substituted a different one. Any
  `AgentScore` carrying this flag must also carry a confidence at or below
  `gateway.router.MODEL_SUBSTITUTION_CONFIDENCE_CAP` — this is not a normal
  low-confidence result, it means the model that produced it was never
  validated against this agent's golden set, and should route to human
  review regardless of the raw score (BR-20, BR-32).
- **Grader keys never appear in `rationale`, `flags`, or any logged
  representation of an `AgentScore`** — see `app/gateway/secrets.py` and
  the structlog redaction test.

## Evidence-pack → score traceability

Every `Evidence.ref` an agent cites must have come from the `EvidenceItem`
with that same `ref` in the `EvidencePack` the evidence builder produced for
that run (AD-014a's new schema). The two share one `ref` vocabulary on
purpose — a ref minted by the evidence builder is guaranteed to be in the
exact shape the output-side validator already expects, so there is nothing
to translate between "what the agent was shown" and "what the agent is
allowed to cite."
