"""Three golden recorded-session fixtures, per architecture review's explicit ask: "drop 2 or 3
sample recorded session JSON fixtures ... one strong candidate, one struggling candidate, one
candidate who just pasted code."

These are built, not stored as static files: a git bundle is a binary blob tied to the git
version and object format that produced it, which makes a checked-in binary fixture fragile
across environments in a way a throwaway-repo-and-real-git-commands fixture (the same pattern
every other test in this package already uses) is not. Each `build_*` function here produces a
real, on-disk session directory -- real git bundles from a real throwaway repo, real JSONL
segments -- deterministic given the same inputs, not a scripted double standing in for one.

Each archetype is deliberately distinguishable on the specific facts the 4 live-session agents
look at, not just vibes:
  strong:     explores first, several small paced snapshots, a failing test run followed by a
              passing one, no large pastes or focus loss.
  struggling: no exploration, one single large snapshot (wrote it all at once), a test that
              only ever fails, no large pastes or focus loss (a struggling candidate is not
              automatically a cheating one).
  pasted:     no exploration, no terminal activity to speak of, one large snapshot that lands
              immediately, a large_paste event recorded.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path


def _git(args: list[str], cwd: Path, env: dict[str, str] | None = None) -> str:
    return subprocess.run(  # noqa: S603
        ["git", *args], cwd=str(cwd), check=True, capture_output=True, text=True, env=env  # noqa: S607
    ).stdout.strip()


def _env() -> dict[str, str]:
    return {
        **os.environ, "GIT_AUTHOR_NAME": "bot", "GIT_AUTHOR_EMAIL": "b@e.com",
        "GIT_COMMITTER_NAME": "bot", "GIT_COMMITTER_EMAIL": "b@e.com",
    }


def _init_workspace(scratch: Path) -> Path:
    workspace = scratch / "workspace"
    workspace.mkdir(parents=True)
    _git(["init", "-q"], workspace)
    return workspace


def _snapshot(workspace: Path, bundles_dir: Path, seq: int, prev_sha: str | None) -> str:
    """Stages the current working tree, commits to the shadow ref, writes an incremental
    bundle -- the same shadow-commit mechanism ws-agent's git_snapshot.py uses, reproduced here
    with plain subprocess calls since services/ws-agent is a separate deployable."""
    env = _env()
    _git(["add", "-A"], workspace, env=env)
    tree = _git(["write-tree"], workspace, env=env)
    parent_args = ["-p", prev_sha] if prev_sha else []
    sha = _git(["commit-tree", tree, *parent_args, "-m", f"snap{seq}"], workspace, env=env)
    _git(["update-ref", "refs/hs-snapshots/main", sha], workspace, env=env)

    bundle_path = bundles_dir / f"{seq:06d}.bundle"
    if prev_sha is None:
        _git(["bundle", "create", str(bundle_path), "refs/hs-snapshots/main"], workspace)
    else:
        rev_range = f"{prev_sha}..refs/hs-snapshots/main"
        _git(["bundle", "create", str(bundle_path), rev_range], workspace)
    return sha


def _write_jsonl(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(json.dumps(r) for r in rows) + "\n", encoding="utf-8")


def build_strong_session(session_dir: Path, scratch: Path) -> None:
    workspace = _init_workspace(scratch)
    bundles_dir = session_dir / "git_bundles"
    bundles_dir.mkdir(parents=True)

    (workspace / "app.py").write_text("def add(a, b):\n    pass\n", encoding="utf-8")
    sha0 = _snapshot(workspace, bundles_dir, 0, None)
    (workspace / "app.py").write_text(
        'def add(a, b):\n    """Return the sum of a and b."""\n    return a + b\n',
        encoding="utf-8",
    )
    _snapshot(workspace, bundles_dir, 1, sha0)

    _write_jsonl(
        session_dir / "terminal_log" / "000000.jsonl",
        [
            {"command": "ls", "cwd": "/w", "exit_code": 0, "duration_ms": 5},
            {"command": "cat app.py", "cwd": "/w", "exit_code": 0, "duration_ms": 5},
            {"command": "git status", "cwd": "/w", "exit_code": 0, "duration_ms": 5},
            {"command": "pytest -q", "cwd": "/w", "exit_code": 1, "duration_ms": 400},
            {"command": "pytest -q", "cwd": "/w", "exit_code": 0, "duration_ms": 420},
        ],
    )
    _write_jsonl(session_dir / "events" / "000000.jsonl", [])


def build_struggling_session(session_dir: Path, scratch: Path) -> None:
    workspace = _init_workspace(scratch)
    bundles_dir = session_dir / "git_bundles"
    bundles_dir.mkdir(parents=True)

    (workspace / "app.py").write_text(
        "def add(a, b):\n"
        "    # tries a lot of things, none of them work yet\n"
        "    result = a - b\n"
        "    result += a\n"
        "    result -= b\n"
        "    result *= 1\n"
        "    return result\n",
        encoding="utf-8",
    )
    _snapshot(workspace, bundles_dir, 0, None)

    _write_jsonl(
        session_dir / "terminal_log" / "000000.jsonl",
        [
            {"command": "pytest -q", "cwd": "/w", "exit_code": 1, "duration_ms": 400},
        ],
    )
    _write_jsonl(session_dir / "events" / "000000.jsonl", [])


def build_pasted_session(session_dir: Path, scratch: Path) -> None:
    workspace = _init_workspace(scratch)
    bundles_dir = session_dir / "git_bundles"
    bundles_dir.mkdir(parents=True)

    (workspace / "app.py").write_text(
        'def add(a, b):\n    """Return the sum of a and b."""\n    return a + b\n',
        encoding="utf-8",
    )
    _snapshot(workspace, bundles_dir, 0, None)

    _write_jsonl(session_dir / "terminal_log" / "000000.jsonl", [])
    _write_jsonl(
        session_dir / "events" / "000000.jsonl",
        [{"ts": 1.0, "kind": "large_paste", "detail": {"chars": 1800}}],
    )
