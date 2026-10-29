-- RLS Verification Script for hs_app role (BR-01)
\echo '=== TEST 1: Unscoped query under hs_app ==='
SET ROLE hs_app;
RESET app.org_id;
SELECT count(*) AS unscoped_org_count FROM app.organizations;
SELECT count(*) AS unscoped_user_count FROM app.users;

\echo '=== TEST 2: Scoped query for Aster Ridge under hs_app ==='
SET app.org_id = '7beb8d79-ccde-5d73-922c-894648d63e54';
SELECT id, name, slug FROM app.organizations;
SELECT count(*) AS aster_user_count FROM app.users;

\echo '=== TEST 3: Cross-tenant query (attempting to read Brindle & Co data) ==='
SELECT count(*) AS cross_tenant_read_count FROM app.users 
WHERE org_id = '71be2757-701f-57b9-840e-05fb72191883';

\echo '=== TEST 4: Cross-tenant write test under hs_app ==='
DO $test$
BEGIN
  BEGIN
    INSERT INTO app.users (id, org_id, email, name, role)
    VALUES (gen_random_uuid(), '71be2757-701f-57b9-840e-05fb72191883', 'hacker@test.com', 'Hacker', 'candidate');
    RAISE EXCEPTION 'RLS failed to block cross-tenant insert!';
  EXCEPTION 
    WHEN check_violation THEN
      RAISE NOTICE 'SUCCESS: RLS check_violation caught! Cross-tenant write was successfully blocked by database policy.';
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'SUCCESS: RLS insufficient_privilege caught! Cross-tenant write was successfully blocked.';
  END;
END;
$test$;

RESET ROLE;
RESET app.org_id;
\echo '=== RLS VERIFICATION COMPLETE ==='

