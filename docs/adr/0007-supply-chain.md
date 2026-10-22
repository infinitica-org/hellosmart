# 0007: Supply-chain security

**Status:** Accepted · 2026-10-22

## Decision
- Exact versions + lockfiles (`save-exact`, `uv.lock`); `ignore-scripts=true` with an explicit allowlist.
- New dependencies need a PR note (purpose, maintenance, licence); dependency review blocks high CVEs and copyleft licences.
- GitHub Actions pinned to full commit SHAs before first merge; Dependabot updates them.
- Images: minimal/distroless bases, non-root, Trivy-scanned, SBOM via Syft, signed + attested with cosign; ECS only runs signed images from our ECR.
- Template images follow the same pipeline.

## Consequences
+ Mitigates the main risk of agent-written code: pulling in unvetted packages.
− Slightly slower dependency adoption.
