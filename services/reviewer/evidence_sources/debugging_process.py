"""Evidence builder for the debugging-process agent (AD-014b, live-session evidence).

This is the reference agent (`agents/debugging-process.yaml`, "copy this shape for every
library agent") -- it has had a spec since AD-014a but no evidence builder behind it. This is
the first one, built against the first two live-session checks: `checks/terminal_log.py`
(test/lint run counts, failure ratio, time-to-first-test-run) and
`checks/session_timeline.py` (session pacing, the "wrote it all at once" red flag). A third
channel, `ai_transcript`, is still not wired in -- it depends on `ai-proxy` actually logging a
real `accepted` flag, not something to build against guessed data (see the live-session
evidence plan, §5/§7).

Reads through `SessionReader` only, never S3/local storage directly, for the same reason
`RepoReader` is the one sanctioned way to read a repo clone.
"""

from __future__ import annotations

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack
from app.sanitizer import normalise, suspicious

from .checks.session_timeline import analyze_session_timeline
from .checks.terminal_log import analyze_terminal_log
from .session_reader import SessionReader

MAX_FAILED_COMMANDS_SHOWN = 10


def _sanitize(pack: EvidencePack, ref: str, text: str) -> str:
    """A candidate's own typed command text is untrusted the same way README text or a code
    sample is -- normalise()/suspicious() at build time, wrap_untrusted() once per prompt
    render (app/prompt.py). Same split as every other evidence builder in this package."""
    cleaned = normalise(text)
    if suspicious(cleaned):
        pack.injection_flags.append(f"{ref}: suspected prompt-injection pattern")
    return cleaned


def _add_terminal_facts(pack: EvidencePack, reader: SessionReader) -> bool:
    commands = reader.terminal_log()
    result = analyze_terminal_log(commands)
    if result is None:
        pack.coverage.append(
            EvidenceCoverage(
                channel="terminal_log", status="unavailable", reason="no commands recorded"
            )
        )
        return False

    ref = "term:fact.terminal_log.aggregate"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact",
            content="; ".join(f"{k}={v}" for k, v in result.items()),
            untrusted=False, sanitized=False,
        )
    )

    failed = [c for c in commands if c["exit_code"] not in (None, 0)][:MAX_FAILED_COMMANDS_SHOWN]
    for i, cmd in enumerate(failed):
        ref = f"term:ev.failed_command.{i}"
        content = f"command={cmd['command']}; exit_code={cmd['exit_code']}; cwd={cmd['cwd']}"
        pack.items.append(
            EvidenceItem(
                ref=ref, source="artifact", content=_sanitize(pack, ref, content),
                untrusted=True, sanitized=True,
            )
        )
    return True


def _add_session_timeline_facts(pack: EvidencePack, reader: SessionReader) -> bool:
    snapshots = reader.snapshot_timeline()
    result = analyze_session_timeline(snapshots)
    if result is None:
        pack.coverage.append(
            EvidenceCoverage(
                channel="git_timeline", status="unavailable", reason="no snapshots recorded"
            )
        )
        return False

    ref = "git:fact.session_timeline.aggregate"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="artifact",
            content="; ".join(f"{k}={v}" for k, v in result.items()),
            untrusted=False, sanitized=False,
        )
    )
    return True


def build_evidence(submission_id: str, session_dir: str) -> EvidencePack:
    pack = EvidencePack(agent_id="debugging-process", submission_id=submission_id)
    reader = SessionReader(session_dir)

    has_terminal = _add_terminal_facts(pack, reader)
    has_timeline = _add_session_timeline_facts(pack, reader)

    pack.coverage.append(
        EvidenceCoverage(
            channel="ai_transcript", status="unavailable",
            reason="ai_transcript channel not yet wired (needs ai-proxy accepted-flag logging)",
        )
    )

    if reader.skipped:
        pack.truncations.extend(reader.skipped)
    if not has_terminal and not has_timeline:
        pack.missing_required.append("session_evidence")
    return pack
