import fs from 'fs';
import path from 'path';

const brdPath = path.resolve('HelloSmart_BRD.md');
const brdContent = fs.readFileSync(brdPath, 'utf8');

const outputDir = path.resolve('apps/docs/content/docs/brd');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Write meta.json
const meta = {
  title: "Business Requirements (BRD)",
  description: "Official HelloSmart.ai Business Requirements Document (BRD) — 150 Inviolable Requirements, User Flows, and Acceptance Criteria",
  pages: [
    "overview",
    "scope-and-stakeholders",
    "end-to-end-user-flow",
    "lifecycle-models",
    "company-requirements",
    "candidate-requirements",
    "platform-admin-requirements",
    "sales-and-billing-requirements",
    "non-functional-requirements",
    "exceptions-and-decisions"
  ]
};

fs.writeFileSync(path.join(outputDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log('✅ Created apps/docs/content/docs/brd/meta.json');

// Split the BRD by ## headings
const sections = brdContent.split(/^##\s+/m);
console.log(`Parsed ${sections.length} sections from HelloSmart_BRD.md`);

// Helper to escape JSX problematic characters in plain text (not in code blocks or tags)
function sanitizeForMdx(text) {
  // Replace unescaped '< ' or '<= ' with &lt; or &le;
  let res = text.replace(/<=\s*/g, '&le; ');
  res = res.replace(/<\s*([0-9]+)/g, '&lt; $1');
  res = res.replace(/app\.hellosmart\.ai\/\{org\}/g, '`app.hellosmart.ai/{org}`');
  return res;
}

// 1. overview.mdx (Sections 0, 1, 2)
const sec0 = sanitizeForMdx(sections[0].replace(/^#\s+.*$/m, '').trim());
const sec1 = sanitizeForMdx(sections[2].replace(/^1\.\s+Executive summary\s*/i, '').trim());
const sec2 = sanitizeForMdx(sections[3].replace(/^2\.\s+Product overview\s*/i, '').trim());

const overviewMdx = `---
title: "BRD: Executive Summary & Overview"
description: "Product vision, core problem, solution pillars, target customers, differentiators, business model, and MMP success metrics."
---

<RoleBadge roles={["sde", "ai", "qa", "mgmt"]} />

# HelloSmart.ai — Business Requirements Document (BRD)

> **Document Context:** Single source of truth for what the product is, who it is for, and what it must do. Directly transcribed from \`HelloSmart_Business_Requirements.xlsx\` (Version 0.2, MMP Scope).

${sec0}

---

## 1. Executive Summary

${sec1}

## 2. Product Overview

${sec2}

### 2.8 High-Level Work Simulation Loop

\`\`\`mermaid
flowchart LR
  A["1. Candidate Workspace (Sysbox VM / Chat)"] -->|"AI Prompts & Tools"| B["2. AI Proxy (Vault, Model Allowlist, Caps)"]
  B -->|"Real Work Output & Diffs"| C["3. Continuous Autosave (RPO &le; 30s)"]
  C -->|"Submission Final Snapshot"| D["4. Independent AI Reviewer Agents"]
  D -->|"Scores with Cited Evidence"| E["5. Hiring Manager Decision (Human-in-the-Loop)"]
\`\`\`
`;

fs.writeFileSync(path.join(outputDir, 'overview.mdx'), overviewMdx);
console.log('✅ Created overview.mdx');

// 2. scope-and-stakeholders.mdx (Sections 3 & 4)
const sec3 = sanitizeForMdx(sections[4].replace(/^3\.\s+Release scope\s*/i, '').trim());
const sec4 = sanitizeForMdx(sections[5].replace(/^4\.\s+Users and stakeholders\s*/i, '').trim());

const scopeStakeholdersMdx = `---
title: "BRD: Scope & Stakeholder Personas"
description: "Release phases (MMP, Phase 2, Phase 3), deferred scope boundaries, and detailed user personas & stakeholder matrix."
---

<RoleBadge roles={["sde", "ai", "qa", "mgmt"]} />

# Release Scope & Stakeholder Personas

Requirements are strictly tagged by release phase. **The MMP is what is built and sold first**; Phase 2 and Phase 3 items are identified so the MMP architecture cleanly accommodates them.

---

## 3. Release Scope

${sec3}

---

## 4. Users and Stakeholders

${sec4}
`;

fs.writeFileSync(path.join(outputDir, 'scope-and-stakeholders.mdx'), scopeStakeholdersMdx);
console.log('✅ Created scope-and-stakeholders.mdx');

// 3. end-to-end-user-flow.mdx (Section 5)
const sec5 = sanitizeForMdx(sections[6].replace(/^5\.\s+End-to-end user flow\s*/i, '').trim());

const endToEndUserFlowMdx = `---
title: "BRD: End-to-End User Flow"
description: "Step-by-step 39-step journey across 10 stages (A through J) with actors, system actions, status transitions, and requirement IDs."
---

<RoleBadge roles={["sde", "ai", "qa", "mgmt"]} />

# End-to-End User Flow (39 Steps across Stages A–J)

The complete lifecycle runs from first visit on the landing page through discovery, quoting, provisioning, candidate assessment, AI agent grading, review finalization, and eventual data retention cleanup.

Each step specifies **who acts**, **what the system does**, the **resulting status**, and the **traceable requirement IDs**.

---

${sec5}
`;

fs.writeFileSync(path.join(outputDir, 'end-to-end-user-flow.mdx'), endToEndUserFlowMdx);
console.log('✅ Created end-to-end-user-flow.mdx');

// 4. lifecycle-models.mdx (Section 6 + Diagrams)
const sec6 = sanitizeForMdx(sections[7].replace(/^6\.\s+Lifecycle and status models\s*/i, '').trim());

const lifecycleModelsMdx = `---
title: "BRD: Lifecycle & Status Models"
description: "Status models and state transitions for Org/Trial, Assessment, Candidate Assignment, Workspace, Review, Quote/Payment, and Deal."
---

<RoleBadge roles={["sde", "ai", "qa", "mgmt"]} />

# Lifecycle and Status Models

Every core domain entity in HelloSmart moves through a strictly defined state machine. Enforced server-side.

---

## Status Models Summary

${sec6}

---

## State Transition Diagrams

### 1. Organization & Trial Lifecycle

\`\`\`mermaid
stateDiagram-v2
  [*] --> Provisioned
  Provisioned --> TrialActive: platform admin invites
  TrialActive --> TrialExpired: Z days elapsed or cap reached
  TrialActive --> PaidActive: quote paid / subscription active
  TrialExpired --> PaidActive: payment received
  PaidActive --> Suspended: dunning failure after grace
  Suspended --> PaidActive: payment resolved
\`\`\`

### 2. Assessment (Task) Lifecycle

\`\`\`mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> DryRunPassed: company admin passes dry run preview
  DryRunPassed --> Published: assign candidates & publish
  Published --> Closed: stop new candidate starts
  Closed --> Archived: hide from active catalog
\`\`\`

### 3. Candidate Assignment Lifecycle

\`\`\`mermaid
stateDiagram-v2
  [*] --> Invited
  Invited --> WindowNotOpen: window has not started yet
  Invited --> Ready: inside window / ready to start
  WindowNotOpen --> Ready: window opens
  Ready --> Connected: consent accepted & workspace launched
  Connected --> InProgress: candidate active in workspace
  InProgress --> Disconnected: fullscreen exit or network drop
  Disconnected --> InProgress: candidate resumes
  InProgress --> Submitted: manual submission
  InProgress --> Submitted: auto-submit at expiry
  Disconnected --> Submitted: auto-submit at expiry
  Ready --> Expired: window closed without start
  Invited --> Revoked: admin revokes invite
\`\`\`

### 4. Workspace Container Lifecycle

\`\`\`mermaid
stateDiagram-v2
  [*] --> Queued
  Queued --> Provisioning: warm pool clone / sysbox init
  Provisioning --> NotConnected: health check passed
  Provisioning --> Failed: launch error (triggers auto-retry & alert)
  NotConnected --> Connected: candidate connects (requests fullscreen)
  Connected --> Disconnected: fullscreen exit or drop (timer keeps running)
  Disconnected --> Connected: candidate resumes
  Connected --> Ended: candidate submits or timer expires
  Ended --> Destroyed: snapshot saved, container cleaned up
  Connected --> Destroyed: admin or company force-destroy
\`\`\`

### 5. Review & Scoring Lifecycle

\`\`\`mermaid
stateDiagram-v2
  [*] --> Pending
  Pending --> AgentsRunning: submission queued for review
  AgentsRunning --> AgentReportReady: independent reviewer agents cite evidence
  AgentReportReady --> HumanReview: hiring manager reviews report
  HumanReview --> Finalized: manager overrides/approves & finalizes
  Finalized --> Released: release results toggle enabled (default OFF)
  Finalized --> Finalized: post-finalize versioned edit
\`\`\`

### 6. Commercial Deal & Payment Lifecycle

\`\`\`mermaid
stateDiagram-v2
  [*] --> Lead
  Lead --> MeetingBooked: cal.com webhook
  MeetingBooked --> MeetingHeld: discovery call completed
  MeetingHeld --> Quoted: custom quote issued
  Quoted --> Paid: Razorpay payment webhook
  Paid --> Provisioned: org & entitlements active
\`\`\`
`;

fs.writeFileSync(path.join(outputDir, 'lifecycle-models.mdx'), lifecycleModelsMdx);
console.log('✅ Created lifecycle-models.mdx');

// 5. company-requirements.mdx (Section 7)
const sec7 = sanitizeForMdx(sections[8].replace(/^7\.\s+Business requirements:\s*Company\s*/i, '').trim());

const companyReqsMdx = `---
title: "BRD: Company Requirements (CO-001 – CO-058)"
description: "Complete business requirements for Company Admins and Reviewers across 18 functional modules with acceptance criteria and notes."
---

<RoleBadge roles={["sde", "ai", "qa", "mgmt"]} />

# Business Requirements: Company (CO-001 – CO-058)

Requirements for company users (Company Admin in the MMP; Reviewer role in Phase 2). Companies are provisioned by HelloSmart after the discovery sales call and configure everything behind their own secure login.

Total Company Requirements: **58** (Must: 45, Should: 12, Could: 1 | MMP: 50, Phase 2: 7, Phase 3: 1).

---

${sec7}
`;

fs.writeFileSync(path.join(outputDir, 'company-requirements.mdx'), companyReqsMdx);
console.log('✅ Created company-requirements.mdx');

// 6. candidate-requirements.mdx (Section 8)
const sec8 = sanitizeForMdx(sections[9].replace(/^8\.\s+Business requirements:\s*Candidate\s*/i, '').trim());

const candidateReqsMdx = `---
title: "BRD: Candidate Requirements (CA-001 – CA-023)"
description: "Candidate portal, workspace modes, full-screen enforcement, autosave, AI assistant, and result viewing requirements."
---

<RoleBadge roles={["sde", "ai", "qa", "mgmt"]} />

# Business Requirements: Candidate (CA-001 – CA-023)

Requirements for candidates taking assessments. Candidates arrive by emailed link or through the master login, where role-based access control (RBAC) securely routes them to the candidate portal. Candidates can never access company or platform admin routes (BR-25).

Total Candidate Requirements: **23** (Must: 17, Should: 6, Could: 0 | MMP: 18, Phase 2: 5, Phase 3: 0).

---

${sec8}
`;

fs.writeFileSync(path.join(outputDir, 'candidate-requirements.mdx'), candidateReqsMdx);
console.log('✅ Created candidate-requirements.mdx');

// 7. platform-admin-requirements.mdx (Section 9)
const sec9 = sanitizeForMdx(sections[10].replace(/^9\.\s+Business requirements:\s*Platform Admin\s*/i, '').trim());

const platformAdminReqsMdx = `---
title: "BRD: Platform Admin Requirements (AD-001 – AD-029)"
description: "Internal administration, accounts, trials & entitlements, private templates, reviewer agent library, workspace orchestration, and retention."
---

<RoleBadge roles={["sde", "ai", "qa", "mgmt"]} />

# Business Requirements: Platform Admin (AD-001 – AD-029)

Requirements for HelloSmart's internal administration: accounts, trials and entitlements, pricing, private templates, reviewer agents, workspaces, routing and governance.

Total Platform Admin Requirements: **29** (Must: 21, Should: 8, Could: 0 | MMP: 25, Phase 2: 4, Phase 3: 0).

---

${sec9}
`;

fs.writeFileSync(path.join(outputDir, 'platform-admin-requirements.mdx'), platformAdminReqsMdx);
console.log('✅ Created platform-admin-requirements.mdx');

// 8. sales-and-billing-requirements.mdx (Section 10)
const sec10 = sanitizeForMdx(sections[11].replace(/^10\.\s+Business requirements:\s*Sales, provisioning and payments\s*/i, '').trim());

const salesBillingReqsMdx = `---
title: "BRD: Sales, Provisioning & Billing (SP-001 – SP-022)"
description: "Commercial sales path, cal.com lead capture, deal pipeline, quote builder, Razorpay payment processing, and enterprise tiers."
---

<RoleBadge roles={["sde", "ai", "qa", "mgmt"]} />

# Business Requirements: Sales, Provisioning and Payments (SP-001 – SP-022)

The commercial path: landing page, cal.com booking, discovery call, quote, payment and provisioning on the standard HelloSmart route, with paid add-ons for own routing, white label and custom templates.

Total Sales & Provisioning Requirements: **22** (Must: 15, Should: 6, Could: 1 | MMP: 18, Phase 2: 3, Phase 3: 1).

---

${sec10}
`;

fs.writeFileSync(path.join(outputDir, 'sales-and-billing-requirements.mdx'), salesBillingReqsMdx);
console.log('✅ Created sales-and-billing-requirements.mdx');

// 9. non-functional-requirements.mdx (Section 11)
const sec11 = sanitizeForMdx(sections[12].replace(/^11\.\s+Non-functional requirements\s*/i, '').trim());

const nonFunctionalReqsMdx = `---
title: "BRD: Non-Functional Requirements (NF-001 – NF-018)"
description: "Security, multi-tenant isolation, data privacy, SLA reliability, cost control, observability, email deliverability, and extensibility."
---

<RoleBadge roles={["sde", "ai", "qa", "mgmt"]} />

# Non-Functional Requirements (NF-001 – NF-018)

Security, privacy, reliability, cost control and extensibility that apply across every persona and runtime component in HelloSmart.

Total Non-Functional Requirements: **18** (Must: 13, Should: 5, Could: 0 | MMP: 15, Phase 2: 1, Phase 3: 2).

---

${sec11}
`;

fs.writeFileSync(path.join(outputDir, 'non-functional-requirements.mdx'), nonFunctionalReqsMdx);
console.log('✅ Created non-functional-requirements.mdx');

// 10. exceptions-and-decisions.mdx (Sections 12, 13, 14, 15)
const sec12 = sanitizeForMdx(sections[13].replace(/^12\.\s+Exception and edge flows\s*/i, '').trim());
const sec13 = sanitizeForMdx(sections[14].replace(/^13\.\s+Decisions and resolved questions\s*/i, '').trim());
const sec14 = sanitizeForMdx(sections[15].replace(/^14\.\s+Assumptions and items to confirm\s*/i, '').trim());
const sec15 = sanitizeForMdx(sections[16].replace(/^15\.\s+Requirements summary and traceability\s*/i, '').trim());

const exceptionsDecisionsMdx = `---
title: "BRD: Exceptions, Decisions & Traceability"
description: "Edge-case handling matrix (EX-01 to EX-17), 12 resolved product decisions, 3 key assumptions, and requirements traceability matrix."
---

<RoleBadge roles={["sde", "ai", "qa", "mgmt"]} />

# Exceptions, Decisions & Requirements Traceability

This document consolidates how the platform recovers when the happy path breaks (17 exception flows), the 12 formally accepted product decisions, key assumptions under legal/counsel review, and the complete traceability matrix.

---

## 12. Exception and Edge Flows

What happens when things break or unexpected actor behavior occurs:

${sec12}

---

## 13. Decisions and Resolved Questions

Every question raised during product definition and requirements gathering has been formally resolved:

${sec13}

---

## 14. Assumptions and Items to Confirm

Collected from the notes column of the requirements workbook. These represent operational assumptions or areas pending outside legal counsel review:

${sec14}

---

## 15. Requirements Summary & Traceability

### Requirements Distribution Matrix

${sec15}
`;

fs.writeFileSync(path.join(outputDir, 'exceptions-and-decisions.mdx'), exceptionsDecisionsMdx);
console.log('✅ Created exceptions-and-decisions.mdx');

console.log('🎉 All 10 BRD MDX documentation files successfully generated!');
