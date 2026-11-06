# Autonomous Reviewer Agent Pipeline Architecture & BullMQ Dispatch Specification

**Target Invariants:** BR-18, BR-19, BR-20, BR-21  
**Author:** Tino Britty J (System Architect & Team Lead)  
**Status:** Approved Architectural Contract  
**Target Engine:** `services/reviewer` (Python FastAPI + AST analysis + LLM Grader Gateways)  

---

## 1. Architectural Pipeline Overview

Traditional technical hiring platforms evaluate candidates with a single monolithic prompt, leading to scoring hallucinations, context drift, and ungrounded verdicts.

HelloSmart uses an **independent multi-agent architecture**:
1. When a candidate submits their assessment (or time expires), an immutable snapshot of their work is archived to S3.
2. A BullMQ worker dispatches independent evaluation jobs to `services/reviewer`.
3. Each rubric dimension is evaluated by a dedicated, isolated reviewer agent.
4. Agents extract deterministic AST and execution evidence, score the candidate against anchored rubrics, and cite **mandatory line numbers and terminal log timestamps**.
5. An Aggregator agent flags scoring discrepancies and synthesizes an executive summary for human-in-the-loop review (BR-20).

```mermaid
flowchart TD
    SUBMIT["Candidate Submits / Expiry (BR-08)"] --> SNAPSHOT["Freeze State & Archive to S3 (BR-11)"]
    SNAPSHOT --> BULLMQ["BullMQ Queue: hs:reviewer:dispatch"]
    
    subgraph REVIEWER_SUITE["services/reviewer Engine (Independent Sandboxes)"]
        direction TB
        BULLMQ --> A1["Agent 1: Correctness & Bug Resolution"]
        BULLMQ --> A2["Agent 2: Code Quality & Architecture"]
        BULLMQ --> A3["Agent 3: Testing Discipline"]
        BULLMQ --> A4["Agent 4: AI Authorship Maturity"]
        BULLMQ --> A5["Agent 5: Integrity & Anti-Cheat Observer"]
        
        A1 --> AGGREGATOR["Aggregator & Confidence Arbiter"]
        A2 --> AGGREGATOR
        A3 --> AGGREGATOR
        A4 --> AGGREGATOR
        A5 --> AGGREGATOR
    end
    
    AGGREGATOR --> SCORECARD["Review Scorecard Ready (app.reviews)"]
    SCORECARD --> HUMAN["Human Reviewer Decision & Override (BR-20)"]
    HUMAN --> RELEASE{"Results Released? (BR-21)"}
    RELEASE -->|Yes| CANDIDATE_VIEW["Candidate Results Portal"]
    RELEASE -->|No (Default)| ARCHIVE["Company Internal Only"]
```

---

## 2. Evidence Ingestion Contract
Each reviewer agent receives a sanitized, structured session payload containing:
- `session_id`: Unique workspace identifier.
- `git_diff`: Unified patch showing all candidate modifications against pinned template commit.
- `terminal_history`: Semantic command stream captured with OSC 133 prompt markers and exit codes.
- `ai_transcript`: Complete chronological prompts, completions, and steering interventions.
- `test_results`: Execution output of automated verification test suites run in the sandbox.

---

## 3. Human Override & Auditability Invariants (BR-20)
- AI agent scores are **evidence for humans, never autonomous verdicts**.
- The platform never auto-rejects candidates based on agent scores or integrity alerts.
- When a company reviewer edits or overrides an agent score, the system enforces a mandatory justification text and creates a versioned review record (`ReviewVersion`) in an append-only audit trail.
