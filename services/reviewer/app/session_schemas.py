"""The session transcript contract: what `ws-agent` (services/ws-agent) writes and
`SessionReader` (evidence_sources/session_reader.py) reads, formalized as Pydantic models the
same way `app/evidence.py` formalizes the EvidencePack contract -- this is what @hellosmart's
architecture review asked for explicitly ("define the JSON schema for the session transcript
SessionReader expects"), so the format is a checked, exported schema rather than only matching
prose in two services' docstrings.

These models are the validation layer `SessionReader` parses JSONL lines against; they are
NOT a rewrite of `evidence_sources.session_reader`'s existing TypedDicts (CommandRecord,
SessionEvent), which stay as the lightweight internal shape evidence builders consume. A line
that fails to validate against these models is a malformed-input problem (skip and record it,
same discipline as RepoReader), not a reason to guess at a shape.

Directory layout these describe (under one `session_dir`):
  git_bundles/NNNNNN.bundle   -- incremental git bundles (binary; not JSON, not modeled here)
  terminal_log/*.jsonl        -- one CommandLogLine per line, sealed segments
  events/*.jsonl              -- one SessionEventLine per line, sealed segments
  session_meta.json           -- one SessionMeta document
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

EventKind = Literal["file_change", "large_paste", "focus_loss", "focus_regain", "idle"]


class CommandLogLine(BaseModel):
    """One line of terminal_log/*.jsonl -- one completed terminal command."""

    command: str = Field(description="The literal command text as typed, redacted at source")
    cwd: str | None = Field(default=None, description="Working directory the command ran in")
    exit_code: int | None = Field(
        default=None,
        description="None if the command never completed (e.g. slot destroyed mid-run)",
    )
    duration_ms: int = Field(ge=0, description="Wall-clock duration of the command")


class SessionEventLine(BaseModel):
    """One line of events/*.jsonl -- one file-activity or integrity-relevant event."""

    ts: float = Field(description="Unix timestamp, seconds")
    kind: EventKind
    detail: dict[str, object] = Field(default_factory=dict)


class SessionMeta(BaseModel):
    """session_meta.json -- written once, at session end."""

    session_id: str
    candidate_id: str = Field(
        description="Pseudonymized, e.g. contributor_xxxx -- never a real name"
    )
    template_id: str
    started_at: float
    ended_at: float
    final_snapshot_seq: int | None = Field(
        default=None, description="None if no git activity was recorded at all"
    )
