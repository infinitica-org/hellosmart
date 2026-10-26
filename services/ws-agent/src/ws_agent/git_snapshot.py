"""Snapshots a candidate's workspace into a parallel git history, without ever touching the
candidate's own branch, HEAD, or staging area.

Mechanism (the same kind of plumbing `git stash create` uses to build a commit object without
disturbing the working tree):
  1. Stage everything (including untracked files, respecting .gitignore) into a throwaway
     index file -- never `.git/index`.
  2. `git write-tree` against that index -> a tree object.
  3. `git commit-tree` with a fixed bot identity, parented on the previous snapshot -> a commit.
  4. Point `refs/hs-snapshots/main` at it -- a ref namespace the candidate's own tooling never
     looks at or lists.

Shipped incrementally as real `git bundle`s (`git bundle create <prev>..<new>`), not a
hand-rolled diff format: bundles are self-verifying (`git bundle verify`), and they handle
renames/binary files/anything else git already handles correctly. The reviewer's SessionReader
reconstructs any point in the session by applying bundles in order into a bare repo.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

_SNAPSHOT_REF = "refs/hs-snapshots/main"
_BOT_NAME = "hs-recorder"
_BOT_EMAIL = "recorder@hellosmart.ai"


class NoChangesError(Exception):
    """Raised when a snapshot would be identical to the previous one -- the caller should
    skip this tick rather than write an empty commit."""


@dataclass
class Snapshot:
    seq: int
    commit_sha: str
    is_full: bool


def _git(args: list[str], cwd: Path, env: dict[str, str] | None = None) -> str:
    result = subprocess.run(  # noqa: S603 -- fixed argv, cwd is the caller-owned workspace
        ["git", *args], cwd=str(cwd), check=True, capture_output=True, text=True, env=env  # noqa: S607
    )
    return result.stdout.strip()


class GitSnapshotter:
    """One instance per candidate workspace. `snapshot()` is called every tick (15s);
    `bundle_for(snapshot)` produces the incremental artifact to upload."""

    def __init__(self, workspace_dir: Path, shadow_index_path: Path) -> None:
        self.workspace_dir = workspace_dir
        self.shadow_index_path = shadow_index_path
        self._seq = 0
        self._last_commit_sha: str | None = None
        if not (workspace_dir / ".git").exists():
            _git(["init", "-q"], workspace_dir)

    def _env(self) -> dict[str, str]:
        import os

        return {
            **os.environ,
            "GIT_INDEX_FILE": str(self.shadow_index_path),
            "GIT_AUTHOR_NAME": _BOT_NAME,
            "GIT_AUTHOR_EMAIL": _BOT_EMAIL,
            "GIT_COMMITTER_NAME": _BOT_NAME,
            "GIT_COMMITTER_EMAIL": _BOT_EMAIL,
        }

    def snapshot(self) -> Snapshot:
        """Stage the current working tree and commit it to the shadow ref. Raises
        NoChangesError if the resulting tree is identical to the last snapshot."""
        env = self._env()
        _git(["add", "-A"], self.workspace_dir, env=env)
        tree_sha = _git(["write-tree"], self.workspace_dir, env=env)

        if self._last_commit_sha is not None:
            prev_tree_sha = _git(
                ["rev-parse", f"{self._last_commit_sha}^{{tree}}"], self.workspace_dir, env=env
            )
            if prev_tree_sha == tree_sha:
                raise NoChangesError

        parent_args = ["-p", self._last_commit_sha] if self._last_commit_sha else []
        commit_sha = _git(
            ["commit-tree", tree_sha, *parent_args, "-m", f"snapshot {self._seq}"],
            self.workspace_dir,
            env=env,
        )
        _git(["update-ref", _SNAPSHOT_REF, commit_sha], self.workspace_dir, env=env)

        is_full = self._last_commit_sha is None
        self._last_commit_sha = commit_sha
        snap = Snapshot(seq=self._seq, commit_sha=commit_sha, is_full=is_full)
        self._seq += 1
        return snap

    def bundle_for(self, snapshot: Snapshot, previous: Snapshot | None, out_path: Path) -> None:
        """Writes a git bundle covering `previous..snapshot` (or everything, for the first
        snapshot) to `out_path`.

        The range's new endpoint must be a named ref, not a bare commit SHA -- `git bundle
        create <sha1>..<sha2>` refuses with "Refusing to create empty bundle" even when the
        range genuinely isn't empty, because a bundle needs something nameable for the
        recipient to track after unbundling. `_SNAPSHOT_REF` always points at the latest
        snapshot by the time this runs, so it names exactly `snapshot.commit_sha`."""
        if previous is None:
            _git(["bundle", "create", str(out_path), _SNAPSHOT_REF], self.workspace_dir)
        else:
            rev_range = f"{previous.commit_sha}..{_SNAPSHOT_REF}"
            _git(["bundle", "create", str(out_path), rev_range], self.workspace_dir)
