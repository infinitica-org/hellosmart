"""AD-014b: code-quality's full-depth signals -- duplication, lint findings (ruff), and
docstring substance (restating-the-name detection) -- the three checks the narrower first pass
deliberately left out."""

from __future__ import annotations

from pathlib import Path

from evidence_sources.code_quality import build_evidence


def test_duplicated_block_is_detected(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    # A >=6-significant-line block repeated verbatim in two files.
    block = "".join(f"    step_{i} = compute_{i}(value) + {i}\n" for i in range(8))
    root.joinpath("a.py").write_text(f"def one(value):\n{block}    return 1\n", encoding="utf-8")
    root.joinpath("b.py").write_text(f"def two(value):\n{block}    return 2\n", encoding="utf-8")

    pack = build_evidence("sub-1", str(root))
    summary = pack.resolve("repo:fact.duplication.summary")
    assert summary is not None
    assert "duplicated_lines=0" not in summary.content
    assert any(r.startswith("repo:ev.duplication.block.") for r in pack.refs)


def test_no_duplication_in_distinct_files(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("a.py").write_text("def one():\n    return 1\n", encoding="utf-8")
    root.joinpath("b.py").write_text("def two():\n    return 2\n", encoding="utf-8")

    pack = build_evidence("sub-1", str(root))
    summary = pack.resolve("repo:fact.duplication.summary")
    assert summary is not None
    assert "duplicated_lines=0" in summary.content


def test_lint_findings_are_reported(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    # F401: unused import -- a real ruff finding, not a scripted one.
    root.joinpath("app.py").write_text(
        "import os\n\n\ndef run():\n    return 1\n", encoding="utf-8"
    )

    pack = build_evidence("sub-1", str(root))
    summary = pack.resolve("repo:fact.lint_count.summary")
    assert summary is not None
    assert "total_findings=0" not in summary.content
    by_rule = pack.resolve("repo:ev.lint.by_rule")
    assert by_rule is not None
    assert "F401" in by_rule.content


def test_clean_file_has_no_lint_findings(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("app.py").write_text("def run():\n    return 1\n", encoding="utf-8")

    pack = build_evidence("sub-1", str(root))
    summary = pack.resolve("repo:fact.lint_count.summary")
    assert summary is not None
    assert "total_findings=0" in summary.content


def test_restating_docstring_is_flagged(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("app.py").write_text(
        'def get_user(user_id):\n    """Get user."""\n    return user_id\n', encoding="utf-8"
    )

    pack = build_evidence("sub-1", str(root))
    summary = pack.resolve("repo:fact.docstring_substance.summary")
    assert summary is not None
    assert "restating_docstrings=1" in summary.content
    assert any(r.startswith("repo:ev.restating_docstring.") for r in pack.refs)


def test_substantive_docstring_is_not_flagged(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("app.py").write_text(
        'def get_user(user_id):\n'
        '    """Look up the user by their external id, raising if none is found."""\n'
        "    return user_id\n",
        encoding="utf-8",
    )

    pack = build_evidence("sub-1", str(root))
    summary = pack.resolve("repo:fact.docstring_substance.summary")
    assert summary is not None
    assert "restating_docstrings=0" in summary.content


def test_full_depth_pack_is_deterministic(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("app.py").write_text(
        'def get_user(user_id):\n    """Get user."""\n    return user_id\n', encoding="utf-8"
    )
    p1 = build_evidence("sub-1", str(root))
    p2 = build_evidence("sub-1", str(root))
    assert p1.model_dump() == p2.model_dump()
