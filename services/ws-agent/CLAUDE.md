# services/ws-agent (Candidate & Workspace)

Small binary inside each slot. Runs as a non-root user separate from the candidate user, so the candidate cannot kill or tamper with it.

- Every 15 s: git snapshot of the workspace (incl. untracked), terminal log segment, editor state → S3 via a presigned PUT URL issued per slot (no AWS credentials in the slot). RPO ≤ 30 s (BR-11, NF-013).
- Heartbeat to the orchestrator; missing heartbeats → host drain + resume on another host.
- Activity events (file_change, terminal_cmd, idle) are batched to the API with the slot token.
- Never captures environment variables or files under `~/.config/hs-secrets`.
