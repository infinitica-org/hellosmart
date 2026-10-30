"""AD-014b: code-quality evidence builder, and one full end-to-end run through the real
gateway/validator/runner against it -- the pilot proving the whole migrated pipeline works."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import pytest

from app.agents.runner import run_agent
from app.agents.spec import load_agent_spec
from app.gateway.interface import (
    ModelCompletionOptions,
    ModelCompletionResult,
    ProviderHealthResult,
)
from app.gateway.router import ModelRouter
from evidence_sources.code_quality import build_evidence


def _write_repo(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    (root / "src").mkdir(parents=True)
    (root / "src" / "app.py").write_text(
        'def total(items):\n'
        '    """Sum a list of numbers."""\n'
        '    return sum(items)\n'
        '\n'
        'def classify(amount):\n'
        '    if amount < 0:\n'
        '        raise ValueError("amounts cannot be negative")\n'
        '    return "big" if amount > 100 else "small"\n',
        encoding="utf-8",
    )
    (root / "README.md").write_text(
        "# Totals\n\nSums a list of numbers.\n\n## Usage\n\npython -m app\n", encoding="utf-8"
    )
    return root


def test_evidence_pack_has_complexity_docstring_and_readme_items(tmp_path: Path) -> None:
    repo = _write_repo(tmp_path)
    pack = build_evidence("sub-1", str(repo))

    assert pack.agent_id == "code-quality"
    refs = pack.refs
    assert "repo:fact.cognitive_complexity.aggregate" in refs
    assert "repo:ev.readme" in refs
    assert any(r.startswith("repo:ev.docstring.") for r in refs)
    assert not pack.missing_required


def test_pack_is_deterministic(tmp_path: Path) -> None:
    repo = _write_repo(tmp_path)
    pack1 = build_evidence("sub-1", str(repo))
    pack2 = build_evidence("sub-1", str(repo))
    assert pack1.model_dump() == pack2.model_dump()


def test_empty_repo_is_missing_required(tmp_path: Path) -> None:
    root = tmp_path / "empty"
    root.mkdir()
    pack = build_evidence("sub-1", str(root))
    assert "documentation" in pack.missing_required


def test_untrusted_items_are_marked_sanitized(tmp_path: Path) -> None:
    repo = _write_repo(tmp_path)
    pack = build_evidence("sub-1", str(repo))
    for item in pack.items:
        if item.untrusted:
            assert item.sanitized


@dataclass
class _ScriptedAdapter:
    provider: str
    reply: str

    @property
    def is_configured(self) -> bool:
        return True

    def supports_model(self, model: str) -> bool:
        return True

    async def check_health(self) -> ProviderHealthResult:
        return ProviderHealthResult(
            provider=self.provider, reachable=True, circuit_state="CLOSED", latency_ms=0.0
        )

    async def complete(self, options: ModelCompletionOptions) -> ModelCompletionResult:
        return ModelCompletionResult(
            output_text=self.reply, provider=self.provider, model=options.model,
            prompt_tokens=10, completion_tokens=10, latency_ms=1.0,
        )


@pytest.mark.asyncio
async def test_end_to_end_code_quality_run_against_the_real_pipeline(tmp_path: Path) -> None:
    """build_evidence -> prompt -> (scripted) model -> validate -> AgentScore, exercising the
    real spec loader, real EvidencePack, real validator and real runner together."""
    repo = _write_repo(tmp_path)
    pack = build_evidence("sub-1", str(repo))
    spec = load_agent_spec("code-quality")

    reply = json.dumps(
        {
            "rubric_item_id": "code-quality",
            "score": 4,
            "confidence": 0.85,
            "rationale": "Short, single-purpose functions with a docstring and a usable README.",
            "evidence": [
                {"ref": "repo:ev.readme", "quote": "Sums a list of numbers."},
            ],
            "flags": [],
        }
    )
    router = ModelRouter(adapters=[_ScriptedAdapter(provider="openrouter", reply=reply)])
    result = await run_agent(spec, pack, router)

    assert result.outcome == "ok"
    assert result.score is not None
    assert result.score.score == 4
    assert result.score.rubric_item_id == "code-quality"
