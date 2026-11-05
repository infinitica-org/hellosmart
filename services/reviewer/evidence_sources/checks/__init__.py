"""Deterministic analysis functions ported from ProjAgentScan's src/checks/ (AD-014b).

Ported WITHOUT ProjAgentScan's check-registry/fact-store wrapper (`@register_check`,
`CheckContext`, `read_fact`) -- that layer exists there because multiple agents share one
cached Tier-1 fact per submission; porting it is a separate, larger piece of infrastructure
this ticket deliberately does not take on (see tasks/AD-014b-reviewer-agent-library.md "Out of
scope"). Each function here is called directly by the one evidence builder that needs it. The
scoring logic itself (what counts as a function, what counts as documented, how cognitive
complexity is computed) is unchanged from ProjAgentScan -- only the fact-store plumbing around
it is gone.
"""
