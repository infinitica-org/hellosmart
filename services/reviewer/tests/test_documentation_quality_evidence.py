"""AD-014b: documentation-quality evidence builder."""

from __future__ import annotations

from pathlib import Path

from evidence_sources.documentation_quality import build_evidence


def test_readme_and_docstrings_are_captured(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("app.py").write_text(
        'def helper(x):\n    """Convert x to a positive integer, raising on negative input."""\n'
        "    if x < 0:\n        raise ValueError(x)\n    return int(x)\n",
        encoding="utf-8",
    )
    root.joinpath("README.md").write_text(
        "# App\n\n## Usage\n\nCall helper(x).\n", encoding="utf-8"
    )

    pack = build_evidence("sub-1", str(root))
    refs = pack.refs
    assert "repo:ev.readme" in refs
    assert any(r.startswith("repo:ev.docstring.") for r in refs)
    assert not pack.missing_required


def test_empty_repo_is_missing_required(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    pack = build_evidence("sub-1", str(root))
    assert "documentation" in pack.missing_required


def test_pack_is_deterministic(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("README.md").write_text("# App\n", encoding="utf-8")
    pack1 = build_evidence("sub-1", str(root))
    pack2 = build_evidence("sub-1", str(root))
    assert pack1.model_dump() == pack2.model_dump()


def test_documentation_quality_samples_the_actual_docstring_text(tmp_path: Path) -> None:
    """A documentation-quality agent with only a per-file coverage count has nothing to quote;
    the original samples the real docstring text of public functions/classes so the model can
    point at the actual words, not just a ratio."""
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("app.py").write_text(
        "def helper(x):\n"
        '    """Convert x to a positive integer, raising on negative input."""\n'
        "    if x < 0:\n        raise ValueError(x)\n    return int(x)\n",
        encoding="utf-8",
    )

    pack = build_evidence("sub-1", str(root))
    sample_refs = [r for r in pack.refs if r.startswith("repo:ev.docstring.sample.")]
    assert sample_refs
    item = pack.resolve(sample_refs[0])
    assert item is not None
    assert "Convert x to a positive integer, raising on negative input." in item.content
    assert any(r.startswith("repo:ev.docstring.coverage.") for r in pack.refs)


def test_restating_docstring_is_flagged_as_a_fact_this_agent_cites(tmp_path: Path) -> None:
    """documentation-quality.yaml's own anchors cite "a docstring that only restates the name"
    as a low-score signal -- the narrower first pass of this evidence builder had no fact to back
    that up at all; this is the gap it closes."""
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
