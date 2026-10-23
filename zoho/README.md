# Zoho Sprints: HelloSmart MMP backlog

Generated from [AGENTS.md](../AGENTS.md) by [tools/build_backlog.py](tools/build_backlog.py). **Do not hand-edit the CSVs**: change AGENTS.md or the mapping in the script, then run `py zoho/tools/build_backlog.py`.

| File | Contents |
|---|---|
| [epics.csv](epics.csv) | 16 epics, owner department seat |
| [sprints.csv](sprints.csv) | S0–S6 with dates and goals + Phase 2/3 backlogs |
| [backlog.csv](backlog.csv) | **204 items**: 150 Stories (every requirement, acceptance criteria in the description) + 54 Tasks (infra, security, content, QA) |

## Totals
| Sprint | Dates | Items | Points |
|---|---|---|---|
| S0 Foundation | 23–30 Oct | 22 | 103 |
| S1 Identity & Tenancy | 2–6 Nov | 29 | 154 |
| S2 Configure | 9–13 Nov | 39 | 217 |
| S3 Candidate Session | 16–20 Nov | 31 | 189 |
| S4 Submit & Review | 23–27 Nov | 24 | 134 |
| S5 Commercial & Ops | 30 Nov–4 Dec | 27 | 135 |
| S6 Harden & Launch | 7–11 Dec | 8 | 32 |
| Backlog: Phase 2 / 3 | not scheduled | 24 | 70 |

Points by owner (MMP, owner only; supporting work is extra): Backend 205 · SDE-2 173 · Architect 141 · SDE-1 116 · AI-2 99 · AI-1 91 · Data Ops 78 · QA-1 31 · QA-2 30. **Backend and SDE-2 are the critical-path seats**; protect them from interruptions and route review overflow to the Architect.

## Import steps
1. **Project:** create *HelloSmart MMP* (Scrum). Item types: Story, Task, Bug. Add the 9 seats as users.
2. **Custom fields** (Settings → Item fields): `Requirement ID` (text), `Supporting` (text), `Phase` (picklist: MMP, Phase 2, Phase 3).
3. **Epics:** create the 16 from `epics.csv` (name + description + owner).
4. **Sprints:** create S0–S6 from `sprints.csv` with start/end dates. Keep Phase 2/3 in the backlog (no sprint).
5. **Items:** Backlog → Import (CSV) → `backlog.csv`. Map columns:
   | CSV | Zoho field |
   |---|---|
   | Item Name | Item Name |
   | Item Type | Item Type |
   | Description | Description |
   | Priority | Priority |
   | Story Points | Story Points / Estimation points |
   | Owner | Owner (match seat → person) |
   | Epic | Epic |
   | Tags | Tags |
   | Requirement ID, Supporting, Phase | the custom fields |
6. **Move to sprints:** filter the backlog by the `Sprint` column value (or tag) and bulk-move each set into its sprint. If your Zoho edition maps a Sprint column on import, map it directly.
7. **Releases:** one release per sprint (`R-S1` … `R-S6`) dated the following Monday; final release **R-LAUNCH 12 Dec 2026**.

## Board conventions
- Statuses: `To do → Brief approved → In progress → In review → On QA → QA verified → Done`.
- A Story is **Done** only when QA verifies it on `qa.hellosmart.ai`.
- Branch and PR names carry the Item ID: `feat/CO-012-bulk-upload`.
- Bugs: type Bug, link to the Story, tag the sprint they were found in.
- Phase 2/3 items (`not-mmp` tag) must not be pulled into a sprint without product sign-off.
