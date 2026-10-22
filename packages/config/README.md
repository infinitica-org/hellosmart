# @hs/config (Architecture & Platform)

Shared ESLint, TypeScript and Prettier config. Security lint rules enabled repo-wide:
- `eslint-plugin-security`, `no-eval`, `no-implied-eval`, `no-new-func`
- `react/no-danger` = error
- custom `hs/require-roles-decorator`: every Nest controller method must have `@Roles()`
- custom `hs/no-client-org-id`: disallow reading `org_id`/`orgId` from request body/query
- `no-console` (use the redacting logger)
