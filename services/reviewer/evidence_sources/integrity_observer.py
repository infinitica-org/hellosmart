"""Evidence builder for the integrity-observer agent (live-session evidence plan).

Per the delivery plan's agent-library table (§4.2): "flags only, never scores." This builder
only reports what `checks/integrity_signals.py` found in `events.jsonl` -- it computes nothing
resembling a verdict. See agents/integrity-observer.yaml's own header comment: the runner has
no mechanical way yet to stop this agent's score from being read as a scoring agent's; that is
a known gap flagged for Architecture, not solved here.

Reads through SessionReader only, same as every other live-session evidence builder.
"""

from __future__ import annotations

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack
from app.sanitizer import normalise, suspicious

from .checks.integrity_signals import analyze_integrity_signals
from .session_reader import SessionReader

MAX_EVENTS_SHOWN = 20


def _sanitize(pack: EvidencePack, ref: str, text: str) -> str:
    cleaned = normalise(text)
    if suspicious(cleaned):
        pack.injection_flags.append(f"{ref}: suspected prompt-injection pattern")
    return cleaned


def build_evidence(submission_id: str, session_dir: str) -> EvidencePack:
    pack = EvidencePack(agent_id="integrity-observer", submission_id=submission_id)
    reader = SessionReader(session_dir)

    events = reader.events()
    result = analyze_integrity_signals(events)
    if result is None:
        pack.coverage.append(
            EvidenceCoverage(
                channel="activity_event", status="unavailable", reason="no events recorded"
            )
        )
        pack.missing_required.append("activity_events")
        if reader.skipped:
            pack.truncations.extend(reader.skipped)
        return pack

    ref = "event:fact.integrity_signals.aggregate"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact",
            content="; ".join(f"{k}={v}" for k, v in result.items()),
            untrusted=False, sanitized=False,
        )
    )

    notable = [e for e in events if e["kind"] in ("large_paste", "focus_loss")]
    for i, event in enumerate(notable[:MAX_EVENTS_SHOWN]):
        item_ref = f"event:ev.notable.{i}"
        content = f"kind={event['kind']}; ts={event['ts']}; detail={event['detail']}"
        pack.items.append(
            EvidenceItem(
                ref=item_ref, source="artifact", content=_sanitize(pack, item_ref, content),
                untrusted=True, sanitized=True,
            )
        )

    pack.truncations.extend(reader.skipped)
    return pack
