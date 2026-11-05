"""Reviewer agent library (AD-014b).

Loads `agents/<id>.yaml` (the shape `debugging-process.yaml` established: one
file, one anchored scale, signals/red_flags) and runs an agent against an
`EvidencePack`, producing a validated `AgentScore`.
"""

from .runner import run_agent
from .spec import AgentSpec, load_agent_spec

__all__ = ["AgentSpec", "load_agent_spec", "run_agent"]
