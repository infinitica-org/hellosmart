# tests (Quality Assurance)

| Folder | What | When |
|---|---|---|
| `e2e/` | Playwright + axe; `@smoke` tag runs per PR, full suite nightly + Thursday regression | PR / nightly |
| `load/` | k6: portals (500 users), workspace launches (100 concurrent), AI proxy RPM | from S5 |
| `injection/` | Prompt-injection corpus against reviewer agents (owned with Data Ops + AI Eng) | nightly from S4 |
| `security/` | Slot escape, IMDS reachability, cross-slot network, BR-25 route isolation, auth abuse (ZAP baseline) | nightly from S3, S6 pen-test |

Traceability: every test name starts with its requirement or rule ID (`CO-012`, `BR-01`). The Zoho release has a matrix of all 126 MMP items → tests.
