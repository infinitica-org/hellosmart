# Security Threat Model: AI Proxy & HashiCorp Vault / AWS KMS Encryption

**Target Invariants:** BR-13, BR-16, BR-17, BR-31  
**Author:** Tino Britty J (System Architect & Team Lead)  
**Status:** Approved Security Architecture  
**Security Sign-Off:** Complete  

---

## 1. Threat Vectors & Mitigations

### Threat Vector 1: Candidate Container Compromise & Key Extraction
- **Attack Scenario**: Candidate executes a shell script or exploits a compiler vulnerability to dump memory, environment variables, or local disk to find external LLM provider keys (OpenAI / Anthropic).
- **Mitigation**:
  - Candidate containers **never** receive real provider keys.
  - The container holds only a short-lived, session-scoped JWT (`hs_ws_...`) issued for 15 minutes.
  - Outbound egress to external LLM provider endpoints (`api.openai.com`, `api.anthropic.com`) is blocked at the host network namespace via nftables.
  - Real provider keys reside solely in HashiCorp Vault / AWS KMS and are decrypted only inside the isolated AI Proxy gateway memory.

### Threat Vector 2: AWS Instance Metadata Service (IMDS) Credential Theft
- **Attack Scenario**: Untrusted code queries `http://169.254.169.254/latest/meta-data/iam/security-credentials/` to steal the host EC2 instance role.
- **Mitigation**:
  - IMDSv2 is enforced on all workspace host EC2 instances (`HttpTokens=required`, `HttpPutResponseHopLimit=1`).
  - Containers running on the host have their network packets decremented by 1 hop, preventing packets from reaching the link-local metadata address.
  - Container nftables rules explicitly reject all traffic destined for `169.254.169.254/32`.

### Threat Vector 3: AI Spend Depletion & Denial of Wallet
- **Attack Scenario**: Candidate writes a recursive script calling the local AI proxy in an infinite loop to run up cloud provider bills.
- **Mitigation**:
  - Sliding-window rate limiter constrains requests to 30 RPM per session using Redis.
  - Real-time token spend counter halts requests when the session budget (e.g. $2.00) is reached.
  - Global org-level compute caps halt all new workspace launches when monthly budget is exhausted.

---

## 2. Vault KMS Secret Storage & Key Lifecycle

1. **At Rest**: Provider keys (`app.provider_keys`) are encrypted using AES-256-GCM with customer-managed keys (CMK) in AWS KMS or HashiCorp Vault Transit Engine.
2. **In Transit**: Decrypted keys travel over mTLS between the AI Proxy and the KMS/Vault service.
3. **In Memory**: Keys are resolved on-demand per request in ephemeral Node.js buffers and wiped after upstream TLS handshake initialization.
4. **Key Masking (BR-16)**: API endpoints and administrative UIs only return the provider name and `last4` characters (e.g. `sk-ant-...4a91`). Full keys are never displayed or logged.
