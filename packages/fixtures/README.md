# @hs/fixtures (Data Ops)

Synthetic, deterministic seed and test data for HelloSmart.ai. **Never real people, real emails or real keys.** All fixture emails use the reserved IETF `.test` domain (`@seed.example.test`).

| Fixture Group    | Contents                                                                                                                                     | Total Seeded |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `platform_admin` | 3 platform admins (super, support, suspended) with non-prod MFA secret refs                                                                  | 3            |
| `organizations`  | Two organizations to prove multi-tenant isolation (`BR-01`): `aster-ridge` (`paid_active`) and `brindle-co` (`trial_active`)                 | 2            |
| `entitlements`   | Template caps, candidate caps, trial bounds, and feature flags per organization                                                              | 2            |
| `company_admin`  | 11 company admins covering active, invited, suspended, deleted, unverified, and locked states                                                | 11           |
| `candidate`      | 19 candidates covering edge cases, unicode names, multi-tenant accounts, and pipeline states (`invited` … `submitted`, `expired`, `revoked`) | 19           |
| **TOTAL**        |                                                                                                                                              | **37**       |

## Commands

```bash
# Seed local database (idempotent; 0 rows created on rerun)
pnpm --filter @hs/fixtures seed
# Or from root:
pnpm db:seed

# Preview operations without writing to database
pnpm --filter @hs/fixtures seed:dry

# Run automated tests against hellosmart_test (refuses non-test DBs)
pnpm --filter @hs/fixtures test

# Initialize or reset the test database
pnpm --filter @hs/fixtures test:setup
```
