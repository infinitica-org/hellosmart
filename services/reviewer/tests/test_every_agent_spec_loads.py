"""Every agents/*.yaml must load cleanly against the real spec schema -- a YAML syntax error
(e.g. an unquoted colon-space inside a multi-line scalar, which this caught for real while
writing integrity-observer.yaml) would otherwise only surface the first time something tries
to run that specific agent."""

from __future__ import annotations

from pathlib import Path

from app.agents.spec import AGENTS_DIR, load_agent_spec


def test_every_agent_yaml_loads_against_the_real_schema() -> None:
    agent_ids = sorted(p.stem for p in Path(AGENTS_DIR).glob("*.yaml"))
    assert agent_ids, "no agent specs found -- AGENTS_DIR path is probably wrong"

    for agent_id in agent_ids:
        spec = load_agent_spec(agent_id)
        assert spec.id == agent_id
