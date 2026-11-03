-- 0013 candidate_cap_tracking (S1-T05-3, BR-06)
-- Track candidate quota consumption upon first workspace launch and supporting indexes for quota enforcement.

-- 1. Add counted_against_cap_at column to app.users
ALTER TABLE app.users ADD COLUMN IF NOT EXISTS counted_against_cap_at timestamptz NULL;

-- 2. Organization candidate-cap counting index
-- Accelerates counting launched candidates per organization (role = 'candidate', active/not deleted, counted_against_cap_at IS NOT NULL)
CREATE INDEX IF NOT EXISTS users_candidate_cap_idx
  ON app.users (org_id, counted_against_cap_at)
  WHERE role = 'candidate' AND deleted_at IS NULL;

-- 3. Pending assessment assignment counting index
-- Accelerates pending assignment counting across eligible statuses (invited, window_not_open, ready)
-- Runs after 0012_assignments.sql so app.assignments table is guaranteed to exist.
CREATE INDEX IF NOT EXISTS assignments_pending_counting_idx
  ON app.assignments (org_id, status, invite_expires_at, first_connect_at)
  WHERE status IN ('invited', 'window_not_open', 'ready') AND first_connect_at IS NULL;

