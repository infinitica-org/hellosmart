"""AD-014b: skills-depth evidence builder, including the import-only-file gaming-vulnerability
fix ported from ProjAgentScan (docs/memory/pitfalls.md #26)."""

from __future__ import annotations

from pathlib import Path

from evidence_sources.skills_depth import build_evidence


def test_genuinely_used_dependency_counts_as_used(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("requirements.txt").write_text("flask\n", encoding="utf-8")
    root.joinpath("app.py").write_text(
        "from flask import Flask\n\napp = Flask(__name__)\n\n\n"
        "@app.route('/')\ndef index():\n    return 'ok'\n",
        encoding="utf-8",
    )
    pack = build_evidence("sub-1", str(root))
    content = pack.resolve("repo:fact.skills.summary")
    assert content is not None
    assert "used_count=1" in content.content
    assert "'flask'" in content.content


def test_dummy_import_only_file_does_not_count_as_used(tmp_path: Path) -> None:
    """The exact attack this evidence builder closes: a file that imports every declared
    package and does nothing else must not make those packages count as used."""
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("requirements.txt").write_text(
        "tensorflow\ntorch\nsqlalchemy\n", encoding="utf-8"
    )
    root.joinpath("deps.py").write_text(
        "import tensorflow\nimport torch\nimport sqlalchemy\n", encoding="utf-8"
    )
    pack = build_evidence("sub-1", str(root))
    content = pack.resolve("repo:fact.skills.summary")
    assert content is not None
    assert "used_count=0" in content.content


def test_same_import_in_a_real_file_still_counts(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("requirements.txt").write_text("uvicorn\n", encoding="utf-8")
    root.joinpath("app.py").write_text(
        "import uvicorn\n\ndef create_app():\n    return object()\n", encoding="utf-8"
    )
    pack = build_evidence("sub-1", str(root))
    content = pack.resolve("repo:fact.skills.summary")
    assert content is not None
    assert "used_count=1" in content.content


def test_domain_breadth_classifies_used_dependencies_by_domain(tmp_path: Path) -> None:
    """The narrower first pass had no fact distinguishing "ten web-framework deps" from "a web
    framework, a database driver, and a testing library" -- this agent's own rubric cites
    breadth across domains, not just the used-dependency count."""
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("requirements.txt").write_text("flask\nsqlalchemy\npytest\n", encoding="utf-8")
    root.joinpath("app.py").write_text(
        "from flask import Flask\n\napp = Flask(__name__)\n\n\n"
        "@app.route('/')\ndef index():\n    return 'ok'\n",
        encoding="utf-8",
    )
    root.joinpath("db.py").write_text(
        "import sqlalchemy\n\nengine = sqlalchemy.create_engine('sqlite://')\n", encoding="utf-8"
    )
    root.joinpath("test_app.py").write_text(
        "import pytest\n\n\ndef test_ok():\n    assert pytest\n", encoding="utf-8"
    )

    pack = build_evidence("sub-1", str(root))
    breadth = pack.resolve("repo:fact.skills.domain_breadth")
    assert breadth is not None
    assert "domain_count=3" in breadth.content
    assert any(r.startswith("repo:ev.skill_domain.web") for r in pack.refs)
    assert any(r.startswith("repo:ev.skill_domain.database") for r in pack.refs)
    assert any(r.startswith("repo:ev.skill_domain.testing") for r in pack.refs)


def test_unused_dependencies_do_not_count_toward_domain_breadth(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("requirements.txt").write_text("torch\n", encoding="utf-8")
    root.joinpath("app.py").write_text("x = 1\n", encoding="utf-8")

    pack = build_evidence("sub-1", str(root))
    breadth = pack.resolve("repo:fact.skills.domain_breadth")
    assert breadth is not None
    assert "domain_count=0" in breadth.content


def test_pack_is_deterministic(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("requirements.txt").write_text("flask\n", encoding="utf-8")
    root.joinpath("app.py").write_text("import flask\nflask.Flask(__name__)\n", encoding="utf-8")
    p1 = build_evidence("sub-1", str(root))
    p2 = build_evidence("sub-1", str(root))
    assert p1.model_dump() == p2.model_dump()
