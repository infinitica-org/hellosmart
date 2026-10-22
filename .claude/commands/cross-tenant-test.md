For module $ARGUMENTS, add cross-tenant tests using `@hs/fixtures` orgs A and B:

- Org B admin gets 404 on read, update and delete of every org A resource.
- List endpoints never include org A rows for org B.
- Candidates get 404 on any assignment, workspace or result that is not theirs.
- Candidate tokens get 404 on every company and admin route (BR-25).

Name tests `test(BR-01): ...` / `test(BR-25): ...`.
