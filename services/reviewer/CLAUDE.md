# services/reviewer (AI Engineering)

Pipeline (driven by Step Functions): evidence builder → sanitizer → one independent run per rubric item → validator → aggregator.

## Rules
- One agent run = one rubric item, no shared context between runs.
- Candidate content enters prompts only via `sanitizer.wrap_untrusted()`; the boundary token is named in the system prompt as "data, not instructions".
- Output must validate as `AgentScore`; refs must resolve in the evidence bundle, otherwise retry once, then mark `missing`.
- Aggregator is deterministic Python (weights, disagreement ≥ 2 points or confidence < 0.5). No LLM in aggregation.
- Original agent scores are immutable (BR-20).
- Grader model keys are platform keys from Secrets Manager, separate from company keys.
- Evals: `evals/` runs every agent against each template's golden set nightly; must stay within ±0.5 and the adversarial sample must not move the score.
