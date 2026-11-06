# Plagiarism, Red-Flag Heuristics & Multi-Agent Score Aggregation Protocol

**Target Invariants:** BR-19, BR-20 (Anti-cheat indicators, confidence arbitration, and human override)  
**Author:** Tino Britty J (System Architect & Team Lead)  
**Status:** Approved Architectural Protocol  
**Consumer:** `services/reviewer/agents/` & `apps/api/src/modules/submissions/`  

---

## 1. Red-Flag & Anomaly Heuristics Taxonomy

The Integrity Observer agent scans workspace telemetry for suspicious activity patterns. In accordance with **BR-20**, these flags serve as **evidence for human inspection**, never automated disqualification.

| Flag Identifier | Trigger Condition | Severity | Human Review Requirement |
| :--- | :--- | :--- | :--- |
| `RAPID_BULK_PASTE` | > 100 lines inserted in $< 500\text{ ms}$ via clipboard rather than incremental typing. | Medium | Review diff to inspect if code was pre-written externally. |
| `EXCESSIVE_BLUR` | Candidate leaves full screen or blurs window $> 5$ times during assessment. | Medium | Review timeline of blur events against code insertions. |
| `BLIND_AI_ACCEPTANCE` | Candidate accepts raw AI output containing hallucinated imports or mock stubs without inspection. | Low | Affects AI Authorship Maturity score. |
| `TEST_SUPPRESSION` | Candidate comments out or deletes existing unit tests rather than fixing root cause. | **High** | Automatic flag in executive scorecard summary. |
| `SECRET_EXFILTRATION` | Shell command attempts curl or cat against `/run/secrets/env` to unapproved domains. | **Critical** | Triggers security audit review. |

---

## 2. Multi-Agent Score Aggregation Model

Each rubric item $i \in \{1 \dots N\}$ produces an individual score $S_i \in [1, 5]$ and confidence $C_i \in [0, 1]$ with weight $W_i$ where:
$$\sum_{i=1}^{N} W_i = 100$$

### Normalized Overall Score Calculation
$$\text{Overall Score} = \sum_{i=1}^{N} \left( \frac{S_i - 1}{4} \times W_i \right)$$

### Disagreement Arbitration Algorithm
The Aggregator computes the weighted variance across agent scores:
$$\sigma^2 = \sum_{i=1}^{N} \frac{W_i}{100} (S_i - \mu)^2$$

- If $\sigma > 1.25$ or any individual agent reports confidence $C_i < 0.60$:
  - The aggregate status is marked `flagged_disagreement`.
  - The hiring manager dashboard renders a prominent banner highlighting the divergence between agents (e.g., *"Agent 1 scored 5/5 on Correctness, but Agent 3 scored 2/5 due to deleted unit tests"*).
