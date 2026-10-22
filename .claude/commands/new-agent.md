Create reviewer agent $ARGUMENTS following `services/reviewer/CLAUDE.md`:

- `services/reviewer/agents/$ARGUMENTS.yaml`: evidence_channels, scale, anchors, signals, red_flags, model.
- Output must validate against `AgentScore` (score, confidence, rationale, evidence[] with resolvable refs, flags).
- Golden-set eval in `services/reviewer/evals/`: within ±0.5 of human labels; adversarial submission must not move the score.
- Candidate content only ever appears inside the untrusted-content delimiter, never in the system prompt.
