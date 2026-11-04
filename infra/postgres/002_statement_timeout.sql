-- Role defaults survive PgBouncer DISCARD ALL. Do not SET statement_timeout per session.
ALTER ROLE hs_app SET statement_timeout = '5s';
ALTER ROLE hs_platform SET statement_timeout = '5s';
