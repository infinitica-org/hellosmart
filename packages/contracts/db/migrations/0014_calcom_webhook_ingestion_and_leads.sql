-- 0014_calcom_webhook_ingestion_and_leads.sql
-- Sprint 1, Stream 9, Ticket S1-T09-1: Cal.com Webhook Ingestion & Sales Lead Pipeline
-- Tables: app.webhook_deliveries, app.webhook_delivery_outcomes, app.webhook_inbox,
--         app.booking_tombstones, app.leads, app.lead_bookings
-- Security: RLS enable + force, least privilege grants (hs_platform, hs_app), append-only triggers.

-- 1. Webhook Deliveries (Monthly Range-Partitioned on delivered_at)
CREATE TABLE IF NOT EXISTS app.webhook_deliveries (
  id uuid DEFAULT gen_random_uuid(),
  delivered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  gateway text NOT NULL DEFAULT 'calcom',
  event_key text,
  payload_hash text,
  raw_payload_bytes bytea NOT NULL,
  headers jsonb NOT NULL,
  PRIMARY KEY (id, delivered_at)
) PARTITION BY RANGE (delivered_at);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_key
  ON app.webhook_deliveries (event_key, delivered_at DESC);

-- 2. Webhook Delivery Outcomes (Co-partitioned with deliveries on delivered_at)
CREATE TABLE IF NOT EXISTS app.webhook_delivery_outcomes (
  id uuid DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL,
  delivered_at timestamptz NOT NULL,
  outcome text NOT NULL,
  reason text,
  error_code text,
  executed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (id, delivered_at),
  CONSTRAINT chk_delivery_outcome_type CHECK (
    outcome IN ('processed', 'duplicate_processed', 'quarantined', 'failed', 'ignored')
  ),
  CONSTRAINT fk_delivery_outcomes_delivery
    FOREIGN KEY (delivery_id, delivered_at)
    REFERENCES app.webhook_deliveries (id, delivered_at)
    ON DELETE RESTRICT,
  CONSTRAINT uq_delivery_outcomes_attempt
    UNIQUE (delivery_id, delivered_at)
) PARTITION BY RANGE (delivered_at);

CREATE INDEX IF NOT EXISTS idx_webhook_delivery_outcomes_outcome
  ON app.webhook_delivery_outcomes (outcome, executed_at DESC);

-- 3. Webhook Canonical Inbox (Durable State Engine)
CREATE TABLE IF NOT EXISTS app.webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gateway text NOT NULL DEFAULT 'calcom',
  event_key text NOT NULL,
  event_type text NOT NULL,
  booking_uid text NOT NULL,
  payload_hash text NOT NULL,
  sanitized_payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received',
  quarantine_reason text,
  first_delivery_id uuid NOT NULL,
  first_delivered_at timestamptz NOT NULL,
  last_delivery_id uuid NOT NULL,
  last_delivered_at timestamptz NOT NULL,
  delivery_count int NOT NULL DEFAULT 1,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  processed_at timestamptz,
  quarantined_at timestamptz,
  CONSTRAINT chk_webhook_inbox_status CHECK (
    status IN ('received', 'processed', 'quarantined', 'ignored')
  ),
  CONSTRAINT uq_webhook_inbox_gateway_key UNIQUE (gateway, event_key),
  CONSTRAINT fk_inbox_first_delivery
    FOREIGN KEY (first_delivery_id, first_delivered_at)
    REFERENCES app.webhook_deliveries (id, delivered_at)
    ON DELETE RESTRICT,
  CONSTRAINT fk_inbox_last_delivery
    FOREIGN KEY (last_delivery_id, last_delivered_at)
    REFERENCES app.webhook_deliveries (id, delivered_at)
    ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_inbox_reconciliation
  ON app.webhook_inbox (status, received_at)
  WHERE status = 'received';

-- 4. Booking Cancellation Tombstones (For out-of-order cancellation resilience)
CREATE TABLE IF NOT EXISTS app.booking_tombstones (
  uid text PRIMARY KEY,
  status text NOT NULL DEFAULT 'CANCELLED' CHECK (status = 'CANCELLED'),
  cancellation_reason text,
  cancelled_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- 5. Leads Table (Platform & Org scoped)
CREATE TABLE IF NOT EXISTS app.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES app.organizations(id) ON DELETE SET NULL,
  email citext NOT NULL,
  name text,
  company text,
  calcom_booking_id text,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  stage text NOT NULL DEFAULT 'meeting_booked'
    CHECK (stage IN ('lead', 'meeting_booked', 'meeting_held', 'quoted', 'paid', 'provisioned')),
  owner_user_id uuid REFERENCES app.users(id) ON DELETE SET NULL,
  active_booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  CONSTRAINT uq_leads_email UNIQUE (email),
  CONSTRAINT chk_leads_email_format CHECK (
    email IS NOT NULL AND
    email::text = lower(trim(email::text)) AND
    length(email::text) BETWEEN 3 AND 254 AND
    length(split_part(email::text, '@', 1)) BETWEEN 1 AND 64 AND
    length(split_part(email::text, '@', 2)) BETWEEN 1 AND 253 AND
    position('..' in email::text) = 0 AND
    NOT (split_part(email::text, '@', 1) LIKE '.%' OR split_part(email::text, '@', 1) LIKE '%.') AND
    email::text ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$'
  )
);

CREATE INDEX IF NOT EXISTS idx_leads_search ON app.leads (email, stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leads_org ON app.leads (org_id) WHERE deleted_at IS NULL;

-- 6. Lead Bookings Table
CREATE TABLE IF NOT EXISTS app.lead_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES app.leads(id) ON DELETE RESTRICT,
  calcom_booking_id text NOT NULL,
  uid text NOT NULL,
  predecessor_uid text,
  rescheduled_to_uid text,
  status text NOT NULL DEFAULT 'ACCEPTED'
    CHECK (status IN ('ACCEPTED', 'RESCHEDULED', 'CANCELLED', 'REJECTED')),
  title text,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  meeting_url text,
  cancellation_reason text,
  raw_booking_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_lead_bookings_uid UNIQUE (uid),
  CONSTRAINT uq_lead_bookings_id_lead_id UNIQUE (id, lead_id),
  CONSTRAINT chk_booking_time_range CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_lead_bookings_uid ON app.lead_bookings (uid);
CREATE INDEX IF NOT EXISTS idx_lead_bookings_lead_status ON app.lead_bookings (lead_id, status);
CREATE INDEX IF NOT EXISTS idx_lead_bookings_lineage ON app.lead_bookings (predecessor_uid, rescheduled_to_uid);

-- 7. Active Booking Composite Ownership FK on Leads
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_leads_active_booking_ownership'
  ) THEN
    ALTER TABLE app.leads ADD CONSTRAINT fk_leads_active_booking_ownership
      FOREIGN KEY (active_booking_id, id)
      REFERENCES app.lead_bookings (id, lead_id)
      ON DELETE SET NULL (active_booking_id);
  END IF;
END $$;

-- 8. Immutability & Protection Triggers
CREATE OR REPLACE FUNCTION app.enforce_inbox_immutability()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.gateway IS DISTINCT FROM OLD.gateway OR
       NEW.event_key IS DISTINCT FROM OLD.event_key OR
       NEW.event_type IS DISTINCT FROM OLD.event_type OR
       NEW.booking_uid IS DISTINCT FROM OLD.booking_uid OR
       NEW.payload_hash IS DISTINCT FROM OLD.payload_hash OR
       NEW.first_delivery_id IS DISTINCT FROM OLD.first_delivery_id OR
       NEW.first_delivered_at IS DISTINCT FROM OLD.first_delivered_at OR
       NEW.received_at IS DISTINCT FROM OLD.received_at THEN
      RAISE EXCEPTION 'Protected identity fields in app.webhook_inbox cannot be modified (SQLSTATE 55000).'
        USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Deletion from app.webhook_inbox is strictly prohibited (SQLSTATE 55000).'
      USING ERRCODE = '55000';
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inbox_immutability ON app.webhook_inbox;
CREATE TRIGGER trg_inbox_immutability
  BEFORE UPDATE OR DELETE ON app.webhook_inbox
  FOR EACH ROW EXECUTE FUNCTION app.enforce_inbox_immutability();

CREATE OR REPLACE FUNCTION app.enforce_append_only_outcomes()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table app.webhook_delivery_outcomes is append-only (SQLSTATE 55000).'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outcomes_append_only ON app.webhook_delivery_outcomes;
CREATE TRIGGER trg_outcomes_append_only
  BEFORE UPDATE OR DELETE ON app.webhook_delivery_outcomes
  FOR EACH ROW EXECUTE FUNCTION app.enforce_append_only_outcomes();

CREATE OR REPLACE FUNCTION app.block_hard_delete_leads()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Hard deletion of leads is prohibited; set deleted_at to preserve booking audit trails (BR-31).'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_hard_delete_leads ON app.leads;
CREATE TRIGGER trg_block_hard_delete_leads
  BEFORE DELETE ON app.leads
  FOR EACH ROW EXECUTE FUNCTION app.block_hard_delete_leads();

CREATE OR REPLACE FUNCTION app.validate_lead_owner()
RETURNS trigger AS $$
DECLARE
  v_user_org uuid;
  v_user_role text;
BEGIN
  IF NEW.owner_user_id IS NOT NULL THEN
    SELECT org_id, role INTO v_user_org, v_user_role
    FROM app.users
    WHERE id = NEW.owner_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Assigned sales owner % does not exist', NEW.owner_user_id USING ERRCODE = '23503';
    END IF;

    -- Platform admin can own leads across all orgs (including unassigned leads)
    IF v_user_role = 'platform_admin' THEN
      RETURN NEW;
    END IF;

    -- Company admin can only own leads within their own organization
    IF NEW.org_id IS NULL OR v_user_org IS DISTINCT FROM NEW.org_id THEN
      RAISE EXCEPTION 'User % (org %) cannot own lead in org %',
        NEW.owner_user_id, v_user_org, NEW.org_id USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_lead_owner ON app.leads;
CREATE TRIGGER trg_validate_lead_owner
  BEFORE INSERT OR UPDATE OF owner_user_id, org_id ON app.leads
  FOR EACH ROW EXECUTE FUNCTION app.validate_lead_owner();

-- 9. Row Level Security and Privilege Hardening
ALTER TABLE app.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.webhook_deliveries FORCE ROW LEVEL SECURITY;

ALTER TABLE app.webhook_delivery_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.webhook_delivery_outcomes FORCE ROW LEVEL SECURITY;

ALTER TABLE app.webhook_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.webhook_inbox FORCE ROW LEVEL SECURITY;

ALTER TABLE app.booking_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.booking_tombstones FORCE ROW LEVEL SECURITY;

ALTER TABLE app.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.leads FORCE ROW LEVEL SECURITY;

ALTER TABLE app.lead_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.lead_bookings FORCE ROW LEVEL SECURITY;

-- Platform role policies
DROP POLICY IF EXISTS pol_deliveries_platform ON app.webhook_deliveries;
CREATE POLICY pol_deliveries_platform ON app.webhook_deliveries
  FOR ALL TO hs_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pol_deliveries_deny_app ON app.webhook_deliveries;
CREATE POLICY pol_deliveries_deny_app ON app.webhook_deliveries
  FOR ALL TO hs_app USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS pol_outcomes_platform ON app.webhook_delivery_outcomes;
CREATE POLICY pol_outcomes_platform ON app.webhook_delivery_outcomes
  FOR ALL TO hs_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pol_outcomes_deny_app ON app.webhook_delivery_outcomes;
CREATE POLICY pol_outcomes_deny_app ON app.webhook_delivery_outcomes
  FOR ALL TO hs_app USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS pol_inbox_platform ON app.webhook_inbox;
CREATE POLICY pol_inbox_platform ON app.webhook_inbox
  FOR ALL TO hs_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pol_inbox_deny_app ON app.webhook_inbox;
CREATE POLICY pol_inbox_deny_app ON app.webhook_inbox
  FOR ALL TO hs_app USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS pol_tombstones_platform ON app.booking_tombstones;
CREATE POLICY pol_tombstones_platform ON app.booking_tombstones
  FOR ALL TO hs_platform USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pol_tombstones_deny_app ON app.booking_tombstones;
CREATE POLICY pol_tombstones_deny_app ON app.booking_tombstones
  FOR ALL TO hs_app USING (false) WITH CHECK (false);

-- Leads and Bookings isolation
DROP POLICY IF EXISTS pol_leads_isolation ON app.leads;
CREATE POLICY pol_leads_isolation ON app.leads
  FOR ALL TO hs_app, hs_platform
  USING (org_id = app.current_org_id() OR app.is_platform())
  WITH CHECK (org_id = app.current_org_id() OR app.is_platform());

DROP POLICY IF EXISTS pol_bookings_isolation ON app.lead_bookings;
CREATE POLICY pol_bookings_isolation ON app.lead_bookings
  FOR ALL TO hs_app, hs_platform
  USING (
    EXISTS (
      SELECT 1 FROM app.leads l
      WHERE l.id = app.lead_bookings.lead_id
        AND (l.org_id = app.current_org_id() OR app.is_platform())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM app.leads l
      WHERE l.id = app.lead_bookings.lead_id
        AND (l.org_id = app.current_org_id() OR app.is_platform())
    )
  );

-- Grants & Revocations
GRANT SELECT, INSERT ON app.webhook_deliveries TO hs_platform;
GRANT SELECT, INSERT ON app.webhook_delivery_outcomes TO hs_platform;
GRANT SELECT, INSERT, UPDATE (
  status, processed_at, quarantined_at, quarantine_reason,
  last_delivery_id, last_delivered_at, delivery_count
) ON app.webhook_inbox TO hs_platform;
GRANT SELECT, INSERT ON app.booking_tombstones TO hs_platform;
GRANT SELECT, INSERT, UPDATE ON app.leads TO hs_platform;
GRANT SELECT, INSERT, UPDATE ON app.lead_bookings TO hs_platform;

REVOKE UPDATE, DELETE ON app.webhook_deliveries FROM hs_platform;
REVOKE UPDATE, DELETE ON app.webhook_delivery_outcomes FROM hs_platform;
REVOKE DELETE ON app.webhook_inbox FROM hs_platform;

REVOKE ALL ON app.webhook_deliveries FROM hs_app;
REVOKE ALL ON app.webhook_delivery_outcomes FROM hs_app;
REVOKE ALL ON app.webhook_inbox FROM hs_app;
REVOKE ALL ON app.booking_tombstones FROM hs_app;

GRANT SELECT, UPDATE ON app.leads TO hs_app;
GRANT SELECT ON app.lead_bookings TO hs_app;

-- 10. Automated Monthly Partition Provisioning Routine
CREATE OR REPLACE FUNCTION app.provision_monthly_webhook_partitions(target_date date)
RETURNS void AS $$
DECLARE
  v_start text := to_char(date_trunc('month', target_date), 'YYYY-MM-DD');
  v_end text := to_char(date_trunc('month', target_date + interval '1 month'), 'YYYY-MM-DD');
  v_suffix text := to_char(date_trunc('month', target_date), 'YYYY_MM');
  v_del_table text := 'webhook_deliveries_' || v_suffix;
  v_out_table text := 'webhook_delivery_outcomes_' || v_suffix;
BEGIN
  -- 1. Deliveries Child Partition
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS app.%I PARTITION OF app.webhook_deliveries
     FOR VALUES FROM (%L) TO (%L)',
    v_del_table, v_start, v_end
  );
  EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', v_del_table);
  EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', v_del_table);
  EXECUTE format('DROP POLICY IF EXISTS pol_del_child_platform ON app.%I', v_del_table);
  EXECUTE format('CREATE POLICY pol_del_child_platform ON app.%I FOR ALL TO hs_platform USING (true) WITH CHECK (true)', v_del_table);
  EXECUTE format('DROP POLICY IF EXISTS pol_del_child_deny_app ON app.%I', v_del_table);
  EXECUTE format('CREATE POLICY pol_del_child_deny_app ON app.%I FOR ALL TO hs_app USING (false) WITH CHECK (false)', v_del_table);
  EXECUTE format('GRANT SELECT, INSERT ON app.%I TO hs_platform', v_del_table);
  EXECUTE format('REVOKE ALL ON app.%I FROM hs_app', v_del_table);

  -- 2. Outcomes Child Partition
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS app.%I PARTITION OF app.webhook_delivery_outcomes
     FOR VALUES FROM (%L) TO (%L)',
    v_out_table, v_start, v_end
  );
  EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', v_out_table);
  EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY', v_out_table);
  EXECUTE format('DROP POLICY IF EXISTS pol_out_child_platform ON app.%I', v_out_table);
  EXECUTE format('CREATE POLICY pol_out_child_platform ON app.%I FOR ALL TO hs_platform USING (true) WITH CHECK (true)', v_out_table);
  EXECUTE format('DROP POLICY IF EXISTS pol_out_child_deny_app ON app.%I', v_out_table);
  EXECUTE format('CREATE POLICY pol_out_child_deny_app ON app.%I FOR ALL TO hs_app USING (false) WITH CHECK (false)', v_out_table);
  EXECUTE format('GRANT SELECT, INSERT ON app.%I TO hs_platform', v_out_table);
  EXECUTE format('REVOKE ALL ON app.%I FROM hs_app', v_out_table);
END;
$$ LANGUAGE plpgsql;

-- Provision partitions for current month and next 2 months
SELECT app.provision_monthly_webhook_partitions(CURRENT_DATE);
SELECT app.provision_monthly_webhook_partitions((CURRENT_DATE + interval '1 month')::date);
SELECT app.provision_monthly_webhook_partitions((CURRENT_DATE + interval '2 months')::date);
