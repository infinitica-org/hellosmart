"""Answer validation (AD-014b) -- the step `docs/output-contract.md` names and
defers: "A ref that doesn't resolve in the evidence pack, or a quote that
isn't an exact substring of that item's content, is the validator's job
(pipeline step 4, docs/00-architecture-and-delivery-plan.md section 4.3) --
not this schema's -- and results in one retry, then the dimension is marked
missing."

`AgentScore`'s own pydantic validator (schemas.py) already enforces shape
and "at least one evidence entry" -- this module enforces the one thing
pydantic cannot: that every cited ref/quote pair is actually true of the
evidence pack the agent was shown. Whitespace is normalised before matching
(line wrapping/indentation must never reject a faithful quote), but nothing
else about the candidate text is altered -- see ProjAgentScan's
docs/memory/pitfalls.md #20/#25 for why quotable evidence must already be
rendered as plain text, never a JSON blob, before it ever reaches this check.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .evidence import EvidencePack
from .schemas import AgentScore

_WS = re.compile(r"\s+")
MIN_QUOTE_CHARS = 2
MAX_PROBLEMS_REPORTED = 12


def _normalise(text: str) -> str:
    return _WS.sub(" ", text).strip()


@dataclass
class Validation:
    passed: bool
    problems: list[str] = field(default_factory=list)

    def correction_text(self) -> str:
        shown = self.problems[:MAX_PROBLEMS_REPORTED]
        more = len(self.problems) - len(shown)
        tail = f"\n- ... and {more} more" if more > 0 else ""
        return "\n".join(f"- {p}" for p in shown) + tail


def validate_score(score: AgentScore, pack: EvidencePack) -> Validation:
    problems: list[str] = []

    if score.rubric_item_id != pack.agent_id:
        problems.append(
            f"rubric_item_id {score.rubric_item_id!r} does not match the agent being run "
            f"({pack.agent_id!r})"
        )

    for ev in score.evidence:
        item = pack.resolve(ev.ref)
        if item is None:
            problems.append(f"ref {ev.ref!r} is not an evidence id in the pack")
            continue
        quote = _normalise(ev.quote)
        content = _normalise(item.content)
        if not quote:
            problems.append(f"quote for {ev.ref!r} is empty")
            continue
        if len(quote) < MIN_QUOTE_CHARS:
            if quote != content:
                problems.append(
                    f"quote {ev.quote!r} for {ev.ref!r} is too short to prove anything "
                    "(accepted only when it is the item's whole content)"
                )
            continue
        if quote not in content:
            problems.append(f"quote {ev.quote!r} is not text found in {ev.ref!r}")

    return Validation(passed=not problems, problems=problems)
