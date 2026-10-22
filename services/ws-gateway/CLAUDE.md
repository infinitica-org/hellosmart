# services/ws-gateway (Candidate & Workspace · sensitive path)

Authenticated reverse proxy from the browser to a candidate's slot (code-server, terminal, dev-server preview). Runs in the workspaces account behind an internal NLB; exposed via CloudFront + WAF.

- Accepts only a single-use, 60-second connect ticket from the API, exchanged for a slot-bound cookie scoped to `ws.<domain>`.
- Routes strictly by `workspaceId → slot address` from the orchestrator registry; never by user-supplied host/port.
- WebSocket origin check, per-connection rate limits, idle timeout.
- Emits connect/disconnect events to the API (CA-009, CA-011).
- Slots have no public IPs and accept traffic only from the gateway security group.
