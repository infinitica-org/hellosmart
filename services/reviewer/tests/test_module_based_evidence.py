"""AD-014b: architecture-design and comprehension evidence builders (both module-summary
based, evidence_sources/checks/module_summary.py)."""

from __future__ import annotations

from pathlib import Path

from evidence_sources.architecture_design import build_evidence as build_arch_evidence
from evidence_sources.comprehension import build_evidence as build_comprehension_evidence


def _write_layered_repo(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    (root / "shop").mkdir(parents=True)
    root.joinpath("shop", "__init__.py").write_text("", encoding="utf-8")
    root.joinpath("shop", "api.py").write_text(
        "from shop import services\n\n\n"
        "class OrderView:\n    def get(self):\n        return services.list_orders()\n",
        encoding="utf-8",
    )
    root.joinpath("shop", "services.py").write_text(
        "def list_orders():\n    return []\n", encoding="utf-8"
    )
    root.joinpath("README.md").write_text("# Shop\n\nA small shop API.\n", encoding="utf-8")
    return root


def test_architecture_design_evidence_has_modules_and_readme(tmp_path: Path) -> None:
    repo = _write_layered_repo(tmp_path)
    pack = build_arch_evidence("sub-1", str(repo))
    assert pack.agent_id == "architecture-design"
    assert any(r.startswith("repo:ev.module.") for r in pack.refs)
    assert "repo:ev.readme" in pack.refs
    assert not pack.missing_required


def test_architecture_design_is_deterministic(tmp_path: Path) -> None:
    repo = _write_layered_repo(tmp_path)
    p1 = build_arch_evidence("sub-1", str(repo))
    p2 = build_arch_evidence("sub-1", str(repo))
    assert p1.model_dump() == p2.model_dump()


def test_comprehension_evidence_has_modules_and_readme(tmp_path: Path) -> None:
    repo = _write_layered_repo(tmp_path)
    pack = build_comprehension_evidence("sub-1", str(repo))
    assert pack.agent_id == "comprehension"
    assert any(r.startswith("repo:ev.module.") for r in pack.refs)
    assert "repo:ev.readme" in pack.refs


def test_no_python_files_marks_missing_required(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("index.html").write_text("<html></html>\n", encoding="utf-8")
    assert "code_map" in build_arch_evidence("sub-1", str(root)).missing_required
    assert "code_map" in build_comprehension_evidence("sub-1", str(root)).missing_required


def test_architecture_design_detects_a_real_dependency_cycle(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    (root / "pkg").mkdir(parents=True)
    root.joinpath("pkg", "__init__.py").write_text("", encoding="utf-8")
    root.joinpath("pkg", "billing.py").write_text(
        "from pkg import orders\n\n\ndef charge():\n    return orders.total()\n", encoding="utf-8"
    )
    root.joinpath("pkg", "orders.py").write_text(
        "from pkg import billing\n\n\ndef total():\n    return billing.charge()\n", encoding="utf-8"
    )

    pack = build_arch_evidence("sub-1", str(root))
    cycles_fact = pack.resolve("repo:fact.dependency_cycles.aggregate")
    assert cycles_fact is not None
    assert "cycle_count=1" in cycles_fact.content
    assert any(r.startswith("repo:ev.dependency_cycle.") for r in pack.refs)


def test_architecture_design_reports_coupling_hubs(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    (root / "pkg").mkdir(parents=True)
    root.joinpath("pkg", "__init__.py").write_text("", encoding="utf-8")
    root.joinpath("pkg", "config.py").write_text("SETTING = 1\n", encoding="utf-8")
    for name in ("a", "b", "c"):
        root.joinpath("pkg", f"{name}.py").write_text(
            "from pkg import config\n\nx = config.SETTING\n", encoding="utf-8"
        )

    pack = build_arch_evidence("sub-1", str(root))
    coupling_fact = pack.resolve("repo:fact.coupling.aggregate")
    assert coupling_fact is not None
    assert "max_fan_in=3" in coupling_fact.content
    hub = pack.resolve("repo:ev.coupling.high_fan_in")
    assert hub is not None and "pkg.config=3" in hub.content


def test_architecture_design_computes_inheritance_depth(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("models.py").write_text(
        "class Base:\n    pass\n\n\nclass Mid(Base):\n    pass\n\n\nclass Leaf(Mid):\n    pass\n",
        encoding="utf-8",
    )

    pack = build_arch_evidence("sub-1", str(root))
    inheritance_fact = pack.resolve("repo:fact.inheritance_depth.aggregate")
    assert inheritance_fact is not None
    assert "max_depth=2" in inheritance_fact.content
    assert any(r.startswith("repo:ev.inheritance.deepest.") for r in pack.refs)


def test_architecture_design_full_depth_pack_is_deterministic(tmp_path: Path) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    root.joinpath("models.py").write_text(
        "class Base:\n    pass\n\n\nclass Leaf(Base):\n    pass\n", encoding="utf-8"
    )
    p1 = build_arch_evidence("sub-1", str(root))
    p2 = build_arch_evidence("sub-1", str(root))
    assert p1.model_dump() == p2.model_dump()
