-- Migration 0016: Quote Acceptance and Customer Verification Fields
-- Ticket: PHS-I128 / SP-010 (Stream 9)

-- 1. Add acceptance tracking columns to app.quotes
ALTER TABLE app.quotes
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by_ip text,
  ADD COLUMN IF NOT EXISTS accepted_by_user_agent text,
  ADD COLUMN IF NOT EXISTS accepted_by_name text;

-- 2. Ensure accepted_at is populated when status = 'accepted'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_quote_accepted_status'
  ) THEN
    ALTER TABLE app.quotes
      ADD CONSTRAINT chk_quote_accepted_status
      CHECK (status != 'accepted' OR accepted_at IS NOT NULL);
  END IF;
END $$;

-- 3. Indexes for fast status and audit lookups
CREATE INDEX IF NOT EXISTS idx_quotes_accepted_at ON app.quotes (accepted_at) WHERE accepted_at IS NOT NULL;

-- 4. Explicit Column Permissions for Platform Role (hs_platform)
GRANT UPDATE (accepted_at, accepted_by_ip, accepted_by_user_agent, accepted_by_name) ON app.quotes TO hs_platform;
