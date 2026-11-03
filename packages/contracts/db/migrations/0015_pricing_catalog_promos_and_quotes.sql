-- 0015_pricing_catalog_promos_and_quotes.sql
-- Sprint 1, Stream 9, Ticket S1-T09-2: Pricing Catalog, Promo Codes & 18% GST Quote Builder (SP-009)
-- Tables: app.pricing_catalog, app.promo_codes, app.quotes, app.quote_lines, app.promo_redemptions
-- Security: RLS enable + force, least privilege grants, immutable historical snapshots.

-- 1. Pricing Catalog
CREATE TABLE IF NOT EXISTS app.pricing_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('plan', 'custom_template', 'addon')),
  currency text NOT NULL CHECK (currency IN ('INR', 'USD')),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
  billing_type text NOT NULL CHECK (billing_type IN ('recurring', 'one_time')),
  billing_interval text CHECK (billing_interval IN ('month', 'year') OR billing_interval IS NULL),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_catalog_billing CHECK (
    (billing_type = 'recurring' AND billing_interval IN ('month', 'year')) OR
    (billing_type = 'one_time' AND billing_interval IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_pricing_catalog_category ON app.pricing_catalog (category, is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_catalog_code ON app.pricing_catalog (code);

-- 2. Promotional Codes Engine
CREATE TABLE IF NOT EXISTS app.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric(12, 2) NOT NULL CHECK (discount_value > 0),
  currency text CHECK (currency IN ('INR', 'USD') OR currency IS NULL),
  max_uses int CHECK (max_uses > 0 OR max_uses IS NULL),
  current_uses int NOT NULL DEFAULT 0 CHECK (current_uses >= 0),
  eligible_categories text[],
  billing_type_restriction text CHECK (billing_type_restriction IN ('recurring', 'one_time') OR billing_type_restriction IS NULL),
  valid_from timestamptz NOT NULL DEFAULT clock_timestamp(),
  valid_until timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_promo_percentage CHECK (
    (discount_type = 'percentage' AND discount_value <= 100) OR
    (discount_type = 'fixed')
  ),
  CONSTRAINT chk_promo_fixed_currency CHECK (
    (discount_type = 'fixed' AND currency IS NOT NULL) OR
    (discount_type = 'percentage')
  ),
  CONSTRAINT chk_promo_validity_window CHECK (valid_from < valid_until),
  CONSTRAINT chk_promo_usage_cap CHECK (max_uses IS NULL OR current_uses <= max_uses)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_lookup ON app.promo_codes (code, is_active);

-- 3. Commercial Quotes
CREATE TABLE IF NOT EXISTS app.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE NOT NULL,
  lead_id uuid REFERENCES app.leads(id) ON DELETE RESTRICT,
  org_id uuid REFERENCES app.organizations(id) ON DELETE RESTRICT,
  currency text NOT NULL CHECK (currency IN ('INR', 'USD')),
  status text NOT NULL DEFAULT 'issued'
    CHECK (status IN ('draft', 'issued', 'accepted', 'rejected', 'expired', 'superseded')),
  subtotal numeric(12, 2) NOT NULL CHECK (subtotal >= 0),
  discount_total numeric(12, 2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  taxable_amount numeric(12, 2) NOT NULL CHECK (taxable_amount >= 0),
  cgst_total numeric(12, 2) NOT NULL DEFAULT 0 CHECK (cgst_total >= 0),
  sgst_total numeric(12, 2) NOT NULL DEFAULT 0 CHECK (sgst_total >= 0),
  igst_total numeric(12, 2) NOT NULL DEFAULT 0 CHECK (igst_total >= 0),
  tax_total numeric(12, 2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  grand_total numeric(12, 2) NOT NULL CHECK (grand_total >= 0),
  tax_classification text NOT NULL
    CHECK (tax_classification IN ('intra_state', 'inter_state', 'export', 'exempt')),
  seller_jurisdiction jsonb NOT NULL,
  customer_jurisdiction jsonb NOT NULL,
  promo_code_id uuid REFERENCES app.promo_codes(id) ON DELETE RESTRICT,
  notes text,
  public_token_hash text UNIQUE NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  created_by uuid REFERENCES app.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_quote_customer_ref CHECK (
    (lead_id IS NOT NULL AND org_id IS NULL) OR
    (lead_id IS NULL AND org_id IS NOT NULL)
  ),
  CONSTRAINT chk_quote_taxable_reconciliation CHECK (taxable_amount = subtotal - discount_total),
  CONSTRAINT chk_quote_grand_total_reconciliation CHECK (grand_total = taxable_amount + tax_total),
  CONSTRAINT chk_quote_tax_total_reconciliation CHECK (tax_total = cgst_total + sgst_total + igst_total)
);

CREATE INDEX IF NOT EXISTS idx_quotes_lead_id ON app.quotes (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_org_id ON app.quotes (org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_token_hash ON app.quotes (public_token_hash);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON app.quotes (status, expires_at);

-- 4. Quote Line Items (Immutable Historical Snapshots)
CREATE TABLE IF NOT EXISTS app.quote_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES app.quotes(id) ON DELETE CASCADE,
  catalog_product_id uuid NOT NULL REFERENCES app.pricing_catalog(id) ON DELETE RESTRICT,
  product_code text NOT NULL,
  product_name text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('plan', 'custom_template', 'addon')),
  billing_type text NOT NULL CHECK (billing_type IN ('recurring', 'one_time')),
  billing_interval text CHECK (billing_interval IN ('month', 'year') OR billing_interval IS NULL),
  quantity int NOT NULL CHECK (quantity > 0),
  unit_price numeric(12, 2) NOT NULL CHECK (unit_price >= 0),
  line_subtotal numeric(12, 2) NOT NULL CHECK (line_subtotal >= 0),
  discount_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  taxable_amount numeric(12, 2) NOT NULL CHECK (taxable_amount >= 0),
  tax_type text NOT NULL CHECK (tax_type IN ('cgst_sgst', 'igst', 'none')),
  tax_rate numeric(5, 4) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
  tax_amount numeric(12, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total numeric(12, 2) NOT NULL CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_quote_line_calc CHECK (line_subtotal = round(quantity * unit_price, 2)),
  CONSTRAINT chk_quote_line_taxable CHECK (taxable_amount = line_subtotal - discount_amount),
  CONSTRAINT chk_quote_line_total CHECK (line_total = taxable_amount + tax_amount)
);

CREATE INDEX IF NOT EXISTS idx_quote_lines_quote_id ON app.quote_lines (quote_id);

-- 5. Promo Code Redemptions Tracking
CREATE TABLE IF NOT EXISTS app.promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES app.promo_codes(id) ON DELETE RESTRICT,
  quote_id uuid NOT NULL REFERENCES app.quotes(id) ON DELETE CASCADE,
  discount_applied numeric(12, 2) NOT NULL CHECK (discount_applied > 0),
  redeemed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_promo_quote UNIQUE (promo_code_id, quote_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_promo ON app.promo_redemptions (promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_quote ON app.promo_redemptions (quote_id);

-- 6. Immutability Triggers
CREATE OR REPLACE FUNCTION app.enforce_issued_quote_immutability()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- If quote is already issued/accepted/rejected, prohibit altering financial or identity columns
    IF OLD.status IN ('issued', 'accepted', 'rejected', 'expired', 'superseded') THEN
      IF NEW.subtotal IS DISTINCT FROM OLD.subtotal OR
         NEW.discount_total IS DISTINCT FROM OLD.discount_total OR
         NEW.taxable_amount IS DISTINCT FROM OLD.taxable_amount OR
         NEW.cgst_total IS DISTINCT FROM OLD.cgst_total OR
         NEW.sgst_total IS DISTINCT FROM OLD.sgst_total OR
         NEW.igst_total IS DISTINCT FROM OLD.igst_total OR
         NEW.grand_total IS DISTINCT FROM OLD.grand_total OR
         NEW.currency IS DISTINCT FROM OLD.currency OR
         NEW.quote_number IS DISTINCT FROM OLD.quote_number OR
         NEW.public_token_hash IS DISTINCT FROM OLD.public_token_hash OR
         NEW.lead_id IS DISTINCT FROM OLD.lead_id OR
         NEW.org_id IS DISTINCT FROM OLD.org_id THEN
        RAISE EXCEPTION 'Issued commercial quotations are immutable; financial values cannot be modified (SQLSTATE 55000).'
          USING ERRCODE = '55000';
      END IF;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('issued', 'accepted', 'rejected') THEN
      RAISE EXCEPTION 'Issued commercial quotations cannot be deleted (SQLSTATE 55000).'
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_issued_quote_immutability ON app.quotes;
CREATE TRIGGER trg_issued_quote_immutability
  BEFORE UPDATE OR DELETE ON app.quotes
  FOR EACH ROW EXECUTE FUNCTION app.enforce_issued_quote_immutability();

CREATE OR REPLACE FUNCTION app.block_quote_line_modification()
RETURNS trigger AS $$
DECLARE
  v_quote_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO v_quote_status FROM app.quotes WHERE id = OLD.quote_id;
  ELSE
    SELECT status INTO v_quote_status FROM app.quotes WHERE id = NEW.quote_id;
  END IF;

  IF v_quote_status IN ('issued', 'accepted', 'rejected', 'expired', 'superseded') THEN
    RAISE EXCEPTION 'Line items for issued commercial quotes cannot be inserted, updated or deleted (SQLSTATE 55000).'
      USING ERRCODE = '55000';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_block_quote_line_modification ON app.quote_lines;
CREATE TRIGGER trg_block_quote_line_modification
  BEFORE INSERT OR UPDATE OR DELETE ON app.quote_lines
  FOR EACH ROW EXECUTE FUNCTION app.block_quote_line_modification();

-- 7. Row Level Security & Access Policies
ALTER TABLE app.pricing_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.pricing_catalog FORCE ROW LEVEL SECURITY;

ALTER TABLE app.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.promo_codes FORCE ROW LEVEL SECURITY;

ALTER TABLE app.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.quotes FORCE ROW LEVEL SECURITY;

ALTER TABLE app.quote_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.quote_lines FORCE ROW LEVEL SECURITY;

ALTER TABLE app.promo_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.promo_redemptions FORCE ROW LEVEL SECURITY;

-- Platform & Migration Role Policies (hs_platform and hs_migrator have full access)
DROP POLICY IF EXISTS pol_catalog_platform ON app.pricing_catalog;
CREATE POLICY pol_catalog_platform ON app.pricing_catalog
  FOR ALL TO hs_platform, hs_migrator USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pol_promos_platform ON app.promo_codes;
CREATE POLICY pol_promos_platform ON app.promo_codes
  FOR ALL TO hs_platform, hs_migrator USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pol_quotes_platform ON app.quotes;
CREATE POLICY pol_quotes_platform ON app.quotes
  FOR ALL TO hs_platform, hs_migrator USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pol_quote_lines_platform ON app.quote_lines;
CREATE POLICY pol_quote_lines_platform ON app.quote_lines
  FOR ALL TO hs_platform, hs_migrator USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS pol_redemptions_platform ON app.promo_redemptions;
CREATE POLICY pol_redemptions_platform ON app.promo_redemptions
  FOR ALL TO hs_platform, hs_migrator USING (true) WITH CHECK (true);

-- Tenant Role Policies (hs_app)
DROP POLICY IF EXISTS pol_catalog_tenant ON app.pricing_catalog;
CREATE POLICY pol_catalog_tenant ON app.pricing_catalog
  FOR SELECT TO hs_app USING (is_active = true);

DROP POLICY IF EXISTS pol_promos_tenant ON app.promo_codes;
CREATE POLICY pol_promos_tenant ON app.promo_codes
  FOR SELECT TO hs_app USING (is_active = true);

DROP POLICY IF EXISTS pol_quotes_tenant ON app.quotes;
CREATE POLICY pol_quotes_tenant ON app.quotes
  FOR SELECT TO hs_app
  USING (org_id IS NOT NULL AND org_id = app.current_org_id());

DROP POLICY IF EXISTS pol_quote_lines_tenant ON app.quote_lines;
CREATE POLICY pol_quote_lines_tenant ON app.quote_lines
  FOR SELECT TO hs_app
  USING (
    EXISTS (
      SELECT 1 FROM app.quotes q
      WHERE q.id = app.quote_lines.quote_id
        AND q.org_id IS NOT NULL
        AND q.org_id = app.current_org_id()
    )
  );

DROP POLICY IF EXISTS pol_redemptions_deny_tenant ON app.promo_redemptions;
CREATE POLICY pol_redemptions_deny_tenant ON app.promo_redemptions
  FOR ALL TO hs_app USING (false) WITH CHECK (false);

-- Grants & Permissions
GRANT SELECT, INSERT, UPDATE ON app.pricing_catalog TO hs_platform;
GRANT SELECT, INSERT, UPDATE ON app.promo_codes TO hs_platform;
GRANT SELECT, INSERT, UPDATE ON app.quotes TO hs_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.quote_lines TO hs_platform;
GRANT SELECT, INSERT, UPDATE, DELETE ON app.promo_redemptions TO hs_platform;

GRANT SELECT ON app.pricing_catalog TO hs_app;
GRANT SELECT ON app.promo_codes TO hs_app;
GRANT SELECT ON app.quotes TO hs_app;
GRANT SELECT ON app.quote_lines TO hs_app;

-- 8. Initial Product Catalog Sample / Development Default Seeding (Idempotent)
-- NOTE: The following items are sample defaults provided strictly for development, automated testing,
-- and initial environment bootstrapping. They are NOT approved permanent commercial prices.
-- To protect production deployments from unreviewed or accidental customer quotes, all sample entries
-- are seeded as INACTIVE (is_active = false) by default.
-- Administrators must explicitly review, update prices, and activate products via platform admin APIs
-- (/admin/pricing-catalog) before they can be used in commercial quotations.
INSERT INTO app.pricing_catalog (code, name, description, category, currency, unit_price, billing_type, billing_interval, is_active)
VALUES
  ('plan_starter_monthly', 'Starter Subscription (Monthly)', 'Up to 20 candidate assessments per month with standard reviewer agents', 'plan', 'INR', 19999.00, 'recurring', 'month', false),
  ('plan_growth_monthly', 'Growth Subscription (Monthly)', 'Up to 100 candidate assessments per month with custom rubrics and priority VM orchestration', 'plan', 'INR', 49999.00, 'recurring', 'month', false),
  ('plan_enterprise_monthly_usd', 'Enterprise Subscription (Monthly USD)', 'Unlimited assessments, custom VPC routing, white label, and dedicated AI capacity', 'plan', 'USD', 999.00, 'recurring', 'month', false),
  ('template_custom_build', 'Custom Engineering Assessment Template', 'Bespoke scenario architecture and multi-agent rubric tailored to company tech stack', 'custom_template', 'INR', 75000.00, 'one_time', NULL, false),
  ('template_custom_build_usd', 'Custom Engineering Assessment Template (USD)', 'Bespoke scenario architecture and multi-agent rubric tailored to company tech stack', 'custom_template', 'USD', 1200.00, 'one_time', NULL, false),
  ('addon_extra_candidate_pack', 'Candidate Assessment Pack (25 Extra Runs)', 'Bundle of 25 additional candidate cloud VM assessment runs', 'addon', 'INR', 15000.00, 'one_time', NULL, false),
  ('addon_whitelabel', 'White Label & Custom Domain Branding', 'Company branded login, custom subdomain, and removal of HelloSmart badges', 'addon', 'INR', 30000.00, 'one_time', NULL, false)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  unit_price = EXCLUDED.unit_price;
