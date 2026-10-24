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
