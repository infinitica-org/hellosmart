Create `tasks/$ARGUMENTS.md` from `tasks/_TEMPLATE.md` for requirement ID $ARGUMENTS.

- Copy the requirement text and acceptance criteria verbatim from AGENTS.md.
- List the contract refs it touches (operationIds, tables, events) from `packages/contracts`.
- List files in scope: only this department's paths (see `.github/CODEOWNERS`).
- Test plan: one test per acceptance criterion, plus cross-tenant, RBAC and audit tests where they apply.
- Explicit out-of-scope list.

Do not write code.
