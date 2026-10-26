# AD-014b: Reviewer agent library -- validator, evidence builders, 8 migrated agents

**Department:** AI Engineering · **Sprint:** · **Zoho item:** (none yet — sub-numbered off AD-014) · **Priority/Phase:** Must · MMP

## Requirement (verbatim from AGENTS.md)

> **AD-014** Maintain reviewer agent library `Must · MMP`
> *Acceptance:* Define agents (prompt/config, model, version, enabled flag); version and roll back.

AD-014a (merged to `dev`, PR #29) scaffolded the AI gateway and the versioned `EvidencePack`/`AgentScore` contract, explicitly deferring "any real agent definition beyond the reference `debugging-process.yaml`" and the ref/quote validator named in its own `docs/output-contract.md` ("a ref that doesn't resolve... is the validator's job... not this schema's"). This ticket is that next slice: the validator, the prompt renderer, the ask-and-retry runner that ties the gateway to it, and 8 real agents -- a from-scratch TypeScript/Python port of a working, previously-calibrated reviewer pipeline (ProjAgentScan, a separate internal repo built and run against real GitHub repos over several weeks), not new designs built from nothing.

## Acceptance criteria
- [x] AC1: `app/validator.py` resolves every `Evidence.ref` against the run's `EvidencePack` and requires `Evidence.quote` to be an exact (whitespace-normalised) substring of that item's `content` -- the step `docs/output-contract.md` names and defers from AD-014a
- [x] AC2: `app/prompt.py` renders one system message (hard rules + the agent's rubric) and one user message (the evidence pack) per attempt; untrusted evidence items are wrapped in exactly one `sanitizer.wrap_untrusted()` call per render (a fresh boundary per attempt, matching that function's own "per-run" scope) -- not at evidence-build time, which would make the stored `EvidencePack` non-deterministic
- [x] AC3: `app/agents/runner.py` asks the gateway, extracts a JSON object from the adapter's raw `output_text` (this gateway has no tool-calling/structured-output support), validates it, and retries with the validator's precise reasons appended, up to the agent's own `max_attempts` -- never a single hardcoded retry count
- [x] AC4: a model-substituted completion (`RoutedCompletion.substituted`) caps the resulting `AgentScore.confidence` at `router.MODEL_SUBSTITUTION_CONFIDENCE_CAP` and adds `flags: ["model_substituted"]` (BR-20)
- [x] AC5: `app/agents/spec.py` defines `agents/<id>.yaml` loading against the shape `debugging-process.yaml` established (`scale`/`anchors`/`signals`/`red_flags`/`evidence_channels`/`max_attempts`/`enabled`) -- the "define agents (prompt/config, model, version, enabled flag)" part of AD-014's acceptance criterion
- [x] AC6: `evidence_sources/repo_io.py` (`RepoReader`) ports ProjAgentScan's candidate-repo-reading safety guarantees unchanged: no symlinks/junctions followed, no path traversal, oversized/binary files skipped and recorded, one deterministic walk, manifest-aware source/test classification
- [x] AC7: 8 agents ported from ProjAgentScan (`code-quality`, `documentation-quality`, `architecture-design`, `comprehension`, `production-readiness`, `skills-depth`, `process`, `ai-authorship-maturity`), each with an `agents/<id>.yaml` and an `evidence_sources/<id>.py` evidence builder; `code-quality` was the depth-complete pilot (cognitive complexity + docstring coverage, full evidence/validator/runner path proven end-to-end against a scripted adapter) -- the other 7 shipped narrower in this ticket's first pass and have since been brought up to ProjAgentScan's full original check depth in follow-up commits on this same branch (see "Full-depth follow-up" below); every one builds a real, deterministic, tested `EvidencePack`, none is a stub that returns empty or fake data
- [x] AC8: the one real security-relevant fix ported from ProjAgentScan's history carries over exactly: `skills-depth`'s evidence builder excludes a Python file whose entire body is import statements from counting toward "this dependency is used" (closes the gaming vector where a single dummy file importing every declared package would otherwise inflate the skill score)
- [x] AC9: `EvidenceRef`'s regex (`app/schemas.py`) gains a `repo:` prefix, additive only -- every evidence id these 8 agents mint is `repo:...`; the existing `term|diff|ai|file|event|test` prefixes are untouched and `schemas/evidence.v1.schema.json` is regenerated (`tools/export_evidence_schema.py`) to match
- [x] AC10: `app/gateway/adapters/fake.py` (AD-014a) returns `AgentScore`-shaped replies instead of its pre-`AgentScore` placeholder -- found by actually running the full pipeline against the real `FakeAdapter` (`LLM_PROVIDER=fake`, the repo-wide zero-network local dev/test convention) for two agents, which failed validation every time until this fix; no existing AD-014a test asserted the old shape

All 10 verified under the repo's actual required command (`uv run pytest && uv run ruff check && uv run mypy .`): 95/95 tests pass, ruff clean, mypy strict clean (0 issues / 69 files) -- after the full-depth follow-up below. No new third-party dependency (stdlib `ast`/`tomllib`/`subprocess`/`re` plus the `pydantic`/`pyyaml` already in `pyproject.toml`). Beyond the automated suite: manually ran evidence-build -> prompt -> gateway -> validate end-to-end against the real `FakeAdapter` for `code-quality` and `process` with real sample repos -- both `outcome=ok` on the first attempt.

## Business rules touched
BR-18 (independent agents, evidence-cited, sanitized input, adversarial suite -- every evidence builder's untrusted items are prompt-injection-tested), BR-20 (scores immutable; model-substitution confidence cap carried through to the runner)

## Contract refs
- API operationIds: none (internal service modules, no new HTTP surface)
- Tables / migrations: none
- Events: none
- Schema: `app/schemas.py`'s `EvidenceRef` gains the `repo` prefix (additive); `schemas/evidence.v1.schema.json` regenerated to match (unchanged structurally, the pattern constraint is the only diff)

## Files in scope (this department only)
- `services/reviewer/app/validator.py`, `app/prompt.py` (new)
- `services/reviewer/app/agents/` (new): `__init__.py`, `spec.py`, `runner.py`
- `services/reviewer/app/schemas.py` (modified: `repo` added to `EvidenceRef`'s prefix regex)
- `services/reviewer/schemas/evidence.v1.schema.json` (regenerated)
- `services/reviewer/evidence_sources/` (new): `repo_io.py`, `checks/{cognitive_complexity,docstring_coverage,module_summary,import_graph,dependency_cycles,coupling,inheritance_depth,code_map,duplication,lint_count,docstring_substance,git_log,ai_boilerplate_signals,api_surface,project_structure,readme_claims,production_signals}.py`, `{code_quality,documentation_quality,architecture_design,comprehension,production_readiness,skills_depth,process,ai_authorship_maturity}.py`
- `services/reviewer/agents/` (new, 8 files): `code-quality.yaml`, `documentation-quality.yaml`, `architecture-design.yaml`, `comprehension.yaml`, `production-readiness.yaml`, `skills-depth.yaml`, `process.yaml`, `ai-authorship-maturity.yaml`
- `services/reviewer/app/gateway/adapters/fake.py` (modified, AD-014a: compatible reply-shape update only, see AC10 -- the rest of `app/gateway/` is untouched)
- `services/reviewer/tests/` (new, 9 files, extended in the full-depth follow-up)

Out of scope for this ticket: `services/ai-proxy` (untouched), `services/reviewer/app/sanitizer/` (existing, reused as-is -- `normalise()`/`suspicious()` called at evidence-build time, `wrap_untrusted()` called once per prompt render; neither the module nor its exports are modified), `services/reviewer/app/gateway/` beyond `adapters/fake.py`'s reply-shape fix (AC10) -- the runner calls the router's existing public `ModelRouter.complete()` unmodified, and `router.py`/`interface.py`/`errors.py`/`circuit_breaker.py`/`secrets.py`/the real provider adapters are untouched, the Step Functions state machine that will eventually drive this (not yet built anywhere in `infra/terraform`; this ticket's pipeline runs as a direct function call, provably correct, with the state-machine wiring as a clearly separate follow-up), `packages/contracts`.

## Full-depth follow-up (closed -- all 7 non-pilot agents now at ProjAgentScan's original check depth)
The first pass of this ticket shipped 7 of the 8 evidence builders narrower than their ProjAgentScan originals (a real, working, tested port of the evidence *selection*, not the full original check depth). Each has since been brought up to full depth in follow-up commits on this same branch, before merge:
- `architecture-design`: adds real dependency-cycle detection (`checks/dependency_cycles.py`, iterative Tarjan SCC), fan-in/fan-out coupling hubs (`checks/coupling.py`), and inheritance-depth chains (`checks/inheritance_depth.py` via `checks/code_map.py`) on top of the import graph (`checks/import_graph.py`).
- `comprehension`: adds HTTP/CLI route extraction (`checks/api_surface.py`), package layout and entry points (`checks/project_structure.py`), and README claims verified against that code -- endpoints, named technologies, and referenced paths (`checks/readme_claims.py`).
- `code-quality` / `documentation-quality`: adds duplication fingerprinting (`checks/duplication.py`), real `ruff`-subprocess lint-finding counts (`checks/lint_count.py`), and docstring-substance detection -- a docstring that only restates the function's own name (`checks/docstring_substance.py`).
- `production-readiness`: adds Dockerfile placeholder/pinned-base-image/multistage detection, CI workflows parsed for configured test/lint steps (not just "a workflow file exists"), structured-logging and custom-exception usage via AST, and database-migration-directory detection (`checks/production_signals.py`).
- `skills-depth`: adds technology-domain breadth classification (web/database/testing/data_ml/cli_system/api_network/serialization) over the already-ported genuinely-used (not just declared) dependency set.
- `ai-authorship-maturity`: adds revision-history signal-stuffing detection and boilerplate/AI-disclaimer marker flagging (`checks/ai_boilerplate_signals.py`, `checks/git_log.py`) on top of the per-file commit-count signals already ported.
- `process`: PR/review-quality evidence is still not sourced here (no template-specific PR-export data available to this ticket) -- the agent's own rubric already treats that signal as `not_applicable` when absent, which is the correct behavior, not a gap; no further depth needed.

Also carried over from ProjAgentScan but adapted rather than ported file-for-file: `documentation-quality`'s evidence builder reuses `code-quality`'s docstring-coverage logic rather than duplicating it.

## Test plan
| AC / BR | Test name | Type |
|---|---|---|
| AC1 | `test_fabricated_quote_is_rejected_then_retried_to_success` | unit |
| AC2 | `test_prompt_injection_in_evidence_does_not_change_the_prompt_structure` | unit |
| AC3 | `test_reply_wrapped_in_a_code_fence_is_still_parsed`, `test_exhausting_every_attempt_on_bad_quotes_marks_invalid` | unit |
| AC4 | `test_model_substitution_caps_confidence_and_flags` | unit |
| AC5 | spec-loading is exercised by every evidence-builder test via `load_agent_spec` against the real `agents/*.yaml` files, plus `app/agents/spec.py` smoke-checked directly against `debugging-process.yaml` and all 8 new files | unit |
| AC6 | `tests/test_repo_io.py` (14 tests, ported from ProjAgentScan's own `tests/conformance/test_repo_io.py`: symlink escape, path traversal, oversized/binary/missing files, exclude-dir walking, manifest classification, file-count cap) | unit |
| AC7 | one `tests/test_<agent>_evidence.py` per agent (determinism + content assertions); `test_end_to_end_code_quality_run_against_the_real_pipeline` runs the full evidence-builder -> prompt -> validator -> runner chain | unit/integration |
| AC8 (BR-18) | `test_dummy_import_only_file_does_not_count_as_used`, `test_same_import_in_a_real_file_still_counts` | unit |
| AC9 | `app.schemas.EvidenceRef` accepting `repo:...` is exercised by every evidence-builder test (every ref they mint is `repo:`-prefixed and must pass pydantic validation to be added to the pack) | unit |
| AC10 | manual: full pipeline run against the real `FakeAdapter` for `code-quality` and `process`, `outcome=ok` first attempt (not in the automated suite -- a manual check against local sample repos, since it exercises the real gateway's `fake` adapter end-to-end rather than a scripted test double) | manual |

## Security notes
No new dependency, no new HTTP surface, no new secret. Every evidence item ProjAgentScan's checks mark as touching candidate-authored content is `untrusted=True` here too, and `EvidenceItem`'s own validator (AD-014a) already refuses `untrusted=True` without `sanitized=True` -- enforced at evidence-build time via `sanitizer.normalise()`/`suspicious()` (flags recorded on `pack.injection_flags`, nothing silently deleted, matching the sanitizer's own documented contract). `wrap_untrusted()`'s actual delimiter wrapping happens once per prompt render (`app/prompt.py`), not at build time -- building it in would have made the stored `EvidencePack` non-deterministic, since that function mints a fresh random boundary on every call (see AC2). `process` and `ai-authorship-maturity` shell out to `git log` with a fixed argv (no candidate-controlled command construction) against the `cwd` the caller already validated as a submission's clone path -- ruff's `S603`/`S607` flags this by default and both occurrences carry a `# noqa` with that justification inline.

## Out of scope
The Step Functions state machine that will eventually orchestrate this in production (needs new `infra/terraform/modules/messaging` work -- not built yet for any pipeline, not just this one); where a candidate's final repo/workspace state is read from in production (S3 snapshot via `ws-agent`, per the decision already recorded against this effort -- needs `@hellosmart/candidate-workspace` to confirm the actual export mechanism before the evidence builders are pointed at a real submission instead of a local clone path); a narrative synthesis step across all 8 agents' scores (also already decided as wanted -- separate follow-up ticket, needs every agent's real output shape settled first); golden-set calibration against real HelloSmart submissions (the rubrics are ported, not yet validated against this system's own scoring).

## Approved by (dept lead) / date
_pending_
