Review the current diff (`git diff main...HEAD`) for:

- Tenancy leaks: queries without `withOrg`, client-supplied `org_id`, cache keys or S3 paths without org prefix.
- Missing `@Roles()` guards or route isolation gaps (BR-25).
- Secrets in code, logs, fixtures, snapshots, error messages.
- Unvalidated input at a boundary; mass assignment.
- SSRF (outbound URLs from user input), SQL/shell/prompt injection, path traversal, unsafe deserialization.
- Missing audit entries for BR-31 actions; non-idempotent webhooks or jobs.
- New dependencies: necessity, maintenance, licence.

Report each finding with file:line, severity and the fix. Fix high/critical before opening the PR.
