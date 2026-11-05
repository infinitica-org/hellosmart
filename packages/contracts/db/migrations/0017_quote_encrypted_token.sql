-- Migration 0017: Secure Encrypted Quote Token for Resend Lifecycle (PHS-I128 / SP-009)
-- Ticket: Stream 9 Security Remediation
-- Adds encrypted_token column to app.quotes allowing durable, server-managed token decryption for customer quote email delivery and resending.

ALTER TABLE app.quotes
  ADD COLUMN IF NOT EXISTS encrypted_token text;

-- Grant hs_platform permissions for inserting and updating encrypted_token
GRANT UPDATE (encrypted_token) ON app.quotes TO hs_platform;

