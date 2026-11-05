"""Evidence builder for the ai-authorship-maturity agent (AD-014b).

Full-depth port of ProjAgentScan's src/agents/ai_authorship_maturity/evidence.py: real git-log
parsing (evidence_sources/checks/git_log.py) feeding the full edit-concentration/revision-count/
substantive-revision-count/signal-stuffing analysis (ai_boilerplate_signals.py), the
current-text boilerplate-marker scan, and now also the separate `commit_history` fact (total
commits, distinct files touched, average time between successive commits on the same file) plus
a raw, oldest-first commit-timeline sample -- the same facts the original agent's rubric cites
(`commit_history`, `refinement_evidence`, `boilerplate_markers`), not the narrower
first-commit-vs-later-commit diff-size comparison this builder started as.
"""

from __future__ import annotations

from app.evidence import EvidenceCoverage, EvidenceItem, EvidencePack
from app.sanitizer import normalise, suspicious

from .checks.ai_boilerplate_signals import analyze_revision_history, find_boilerplate_markers
from .checks.git_log import Commit, git_log, has_git_history, parse_log
from .repo_io import RepoReader, safe_id

MAX_FILES_REPORTED = 20
MAX_COMMITS_SHOWN = 20


def _commit_history_fact(commits: list[Commit]) -> tuple[str, int]:
    """(summary content, total_commits) from the raw commit list, oldest-first."""
    file_times: dict[str, list[int]] = {}
    files_touched: set[str] = set()
    for commit in commits:
        for f in commit["files"]:
            files_touched.add(f["path"])
            file_times.setdefault(f["path"], []).append(commit["ts"])

    gaps = [
        b - a
        for times in file_times.values()
        for a, b in zip(sorted(times), sorted(times)[1:], strict=False)
    ]
    avg_hours = round(sum(gaps) / len(gaps) / 3600, 2) if gaps else None

    content = (
        f"total_commits={len(commits)}; files_touched={len(files_touched)}; "
        f"avg_time_between_commits_hours={avg_hours}"
    )
    return content, len(commits)


def _commits_sample_text(commits: list[Commit]) -> str:
    lines: list[str] = []
    for commit in commits:
        lines.append(f"commit {commit['sha'][:12]} at {commit['ts']}:")
        for f in commit["files"]:
            lines.append(f"  {f['path']} +{f['added']}/-{f['removed']}")
    return "\n".join(lines)


def _sanitize(pack: EvidencePack, ref: str, text: str) -> str:
    cleaned = normalise(text)
    if suspicious(cleaned):
        pack.injection_flags.append(f"{ref}: suspected prompt-injection pattern")
    return cleaned


def build_evidence(submission_id: str, clone_dir: str) -> EvidencePack:
    pack = EvidencePack(agent_id="ai-authorship-maturity", submission_id=submission_id)

    if not has_git_history(clone_dir):
        pack.missing_required.append("commit_log")
        pack.coverage.append(
            EvidenceCoverage(
                channel="git_timeline", status="unavailable", reason="no .git directory"
            )
        )
        return pack

    output, error = git_log(clone_dir)
    if error or output is None:
        pack.missing_required.append("commit_log")
        pack.coverage.append(
            EvidenceCoverage(
                channel="git_timeline", status="unavailable", reason=f"git log failed: {error}"
            )
        )
        return pack

    commits = parse_log(output)
    if not commits:
        pack.missing_required.append("commit_log")
        pack.coverage.append(
            EvidenceCoverage(
                channel="git_timeline", status="not_applicable", reason="no non-merge commits"
            )
        )
        return pack

    history_content, total_commits = _commit_history_fact(commits)
    pack.items.append(
        EvidenceItem(
            ref="repo:fact.commit_history", source="git_timeline", content=history_content,
            untrusted=False, sanitized=False,
        )
    )
    shown_commits = commits[:MAX_COMMITS_SHOWN]
    if len(commits) > MAX_COMMITS_SHOWN:
        pack.truncations.append(f"commits: {MAX_COMMITS_SHOWN} of {total_commits} shown")
    ref = "repo:ev.commits.sample"
    pack.items.append(
        EvidenceItem(
            ref=ref, source="git_timeline",
            content=_sanitize(pack, ref, _commits_sample_text(shown_commits)),
            untrusted=True, sanitized=True,
        )
    )

    signals = analyze_revision_history(commits)
    summary = signals["summary"]
    ref = "repo:fact.refinement_summary"
    content = (
        f"large_single_commit_pct={signals['large_single_commit_pct']}; "
        f"files_with_low_iteration={summary['files_with_low_iteration']}; "
        f"files_with_stuffed_revisions={summary['files_with_stuffed_revisions']}; "
        f"total_files_in_history={len(signals['files'])}"
    )
    pack.items.append(
        EvidenceItem(
            ref=ref, source="git_timeline", content=content, untrusted=False, sanitized=False
        )
    )

    ranked = sorted(signals["files"], key=lambda f: -f["revision_count"])
    for row in ranked[:MAX_FILES_REPORTED]:
        safe_path, _ = safe_id(row["path"])
        item_ref = f"repo:ev.file_history.{safe_path}"
        content = (
            f"file={row['path']}; revision_count={row['revision_count']}; "
            f"substantive_revision_count={row['substantive_revision_count']}; "
            f"edit_concentration={row['edit_concentration']}"
        )
        pack.items.append(
            EvidenceItem(
                ref=item_ref, source="git_timeline", content=_sanitize(pack, item_ref, content),
                untrusted=True, sanitized=True,
            )
        )

    reader = RepoReader(clone_dir)
    path_and_text = []
    for rel in reader.iter_files("source"):
        text = reader.read_text(rel)
        if text:
            path_and_text.append((rel, text))
    flagged = find_boilerplate_markers(path_and_text)
    for flag_row in flagged:
        safe_path, _ = safe_id(flag_row["file"])
        item_ref = f"repo:ev.boilerplate_flag.{safe_path}"
        content = f"file={flag_row['file']}; flags={flag_row['flags']}"
        pack.items.append(
            EvidenceItem(
                ref=item_ref, source="artifact", content=_sanitize(pack, item_ref, content),
                untrusted=True, sanitized=True,
            )
        )

    pack.coverage.append(EvidenceCoverage(channel="git_timeline", status="available"))
    pack.truncations.extend(reader.truncations)
    return pack
