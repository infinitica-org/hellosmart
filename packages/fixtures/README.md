# @hs/fixtures (Data Ops)

Synthetic, deterministic seed and test data. **Never real people, real emails or real keys.** Emails use `@example.test`.

| Fixture        | Contents                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------- |
| `platform`     | 1 platform admin (MFA test secret, test-only)                                                      |
| `orgA`, `orgB` | Two orgs to prove isolation (BR-01). Template `backend-incident-debug` assigned to A only          |
| `assessments`  | One Cloud and one Chat assessment per org, every status                                            |
| `candidates`   | Candidates in every assignment state (invited … submitted, expired, revoked)                       |
| `invitations`  | Candidate invitation tokens (valid, expired, used) for onboarding & reset flow (BR-24)             |
| `submissions`  | Evidence bundles + agent scores so review UI and analytics can be built before real sessions exist |

`pnpm db:seed` loads everything into local Postgres; tests import typed builders from `src/`.
