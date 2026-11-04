import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GstCalculatorService } from '../src/modules/quotes/gst-calculator.service.js';
import { PricingCatalogService } from '../src/modules/quotes/pricing-catalog.service.js';
import { PromoCodesService } from '../src/modules/quotes/promo-codes.service.js';
import { QuotesService } from '../src/modules/quotes/quotes.service.js';

describe('S1-T09-2: Pricing Catalog, Promo Codes & 18% GST Quote Builder', () => {
  let platformPool: pg.Pool;
  let appPool: pg.Pool;
  let catalogService: PricingCatalogService;
  let promoService: PromoCodesService;
  let gstService: GstCalculatorService;
  let quotesService: QuotesService;
  let testLeadId: string;
  let isDbAvailable = false;

  beforeAll(async () => {
    const platformUrl =
      process.env.DATABASE_PLATFORM_URL ||
      'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart';
    const appUrl =
      process.env.DATABASE_URL ||
      'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart';

    platformPool = new pg.Pool({ connectionString: platformUrl, max: 10 });
    appPool = new pg.Pool({ connectionString: appUrl, max: 5 });

    try {
      const client = await platformPool.connect();
      await client.query('SELECT 1');
      await client.query("SELECT set_config('app.is_platform', 'true', false)");
      const lRes = await client.query(
        `INSERT INTO app.leads (email, name, company, stage)
         VALUES ($1, 'Quote Prospect', 'Initech Corp', 'meeting_held')
         RETURNING id`,
        [`lead_init_${Date.now()}@example.com`],
      );
      testLeadId = lRes.rows[0].id;
      // Reset sample products to default inactive state to verify activation guardrails idempotently
      await client.query(
        `UPDATE app.pricing_catalog
         SET is_active = false
         WHERE code IN ('plan_starter_monthly', 'template_custom_build')`,
      );
      client.release();
      isDbAvailable = true;
    } catch (err: any) {
      console.warn('Database not available for integration tests:', err.message);
      isDbAvailable = false;
    }

    const mockConfig: any = {
      SELLER_COUNTRY: 'IN',
      SELLER_STATE: 'KA',
      SELLER_CITY: 'Bengaluru',
      SELLER_PIN_CODE: '560001',
      SELLER_GSTIN: '29ABCDE1234F1Z5',
      INTERNATIONAL_TAX_TREATMENT: 'reject',
    };

    catalogService = new PricingCatalogService(platformPool);
    promoService = new PromoCodesService(platformPool);
    gstService = new GstCalculatorService(mockConfig);
    quotesService = new QuotesService(
      platformPool,
      mockConfig,
      catalogService,
      promoService,
      gstService,
    );
  });

  afterAll(async () => {
    if (platformPool) await platformPool.end().catch(() => {});
    if (appPool) await appPool.end().catch(() => {});
  });

  async function queryPlatform(sql: string, params?: any[]) {
    const client = await platformPool.connect();
    try {
      await client.query("SELECT set_config('app.is_platform', 'true', false)");
      return await client.query(sql, params);
    } finally {
      client.release();
    }
  }

  describe('1. Pricing Catalog Service & Constraints', () => {
    it('creates valid subscription plan with recurring billing interval', async () => {
      if (!isDbAvailable) return;
      const code = `plan_test_${Date.now()}`;
      const item = await catalogService.createCatalogItem({
        code,
        name: 'Enterprise Test Plan',
        category: 'plan',
        currency: 'INR',
        unitPrice: 35000,
        billingType: 'recurring',
        billingInterval: 'month',
      });

      expect(item.id).toBeDefined();
      expect(item.code).toBe(code);
      expect(item.unitPrice).toBe(35000);
      expect(item.billingType).toBe('recurring');
      expect(item.billingInterval).toBe('month');
      expect(item.isActive).toBe(true);
    });

    it('creates custom template and one-time add-on without billing interval', async () => {
      if (!isDbAvailable) return;
      const codeTemplate = `template_test_${Date.now()}`;
      const template = await catalogService.createCatalogItem({
        code: codeTemplate,
        name: 'Bespoke AI Engineer Scenario',
        category: 'custom_template',
        currency: 'INR',
        unitPrice: 85000,
        billingType: 'one_time',
      });
      expect(template.billingType).toBe('one_time');
      expect(template.billingInterval).toBeNull();

      const codeAddon = `addon_test_${Date.now()}`;
      const addon = await catalogService.createCatalogItem({
        code: codeAddon,
        name: 'Extra 50 Candidate Credits',
        category: 'addon',
        currency: 'USD',
        unitPrice: 500,
        billingType: 'one_time',
      });
      expect(addon.currency).toBe('USD');
      expect(addon.unitPrice).toBe(500);
    });

    it('rejects duplicate catalog product code', async () => {
      if (!isDbAvailable) return;
      const code = `dup_code_${Date.now()}`;
      await catalogService.createCatalogItem({
        code,
        name: 'Original Product',
        category: 'addon',
        currency: 'INR',
        unitPrice: 1000,
        billingType: 'one_time',
      });

      await expect(
        catalogService.createCatalogItem({
          code,
          name: 'Duplicate Product',
          category: 'addon',
          currency: 'INR',
          unitPrice: 2000,
          billingType: 'one_time',
        }),
      ).rejects.toThrow();
    });

    it('updates product price dynamically and supports custom INR and USD rates', async () => {
      if (!isDbAvailable) return;
      const code = `dynamic_p_${Date.now()}`;
      const product = await catalogService.createCatalogItem({
        code,
        name: 'Dynamic Service Tier',
        category: 'addon',
        currency: 'USD',
        unitPrice: 250,
        billingType: 'one_time',
      });

      expect(product.unitPrice).toBe(250);

      // Dynamically update price from $250 to $400
      const updated = await catalogService.updateCatalogItem(product.id, {
        unitPrice: 400,
        name: 'Dynamic Service Tier - Updated',
      });

      expect(updated.unitPrice).toBe(400);
      expect(updated.name).toBe('Dynamic Service Tier - Updated');

      const fetched = await catalogService.getCatalogItemById(product.id);
      expect(fetched?.unitPrice).toBe(400);
    });

    it('activates and deactivates catalog products dynamically', async () => {
      if (!isDbAvailable) return;
      const code = `toggle_p_${Date.now()}`;
      const product = await catalogService.createCatalogItem({
        code,
        name: 'Toggleable Product',
        category: 'plan',
        currency: 'INR',
        unitPrice: 15000,
        billingType: 'recurring',
        billingInterval: 'month',
        isActive: true,
      });

      expect(product.isActive).toBe(true);

      const deactivated = await catalogService.setCatalogItemStatus(product.id, false);
      expect(deactivated.isActive).toBe(false);

      const reactivated = await catalogService.setCatalogItemStatus(product.id, true);
      expect(reactivated.isActive).toBe(true);
    });
  });

  describe('2. Promo Code Engine & Concurrency Controls', () => {
    it('evaluates percentage discount correctly on eligible products', async () => {
      if (!isDbAvailable) return;
      const promoCode = `PERC_${Date.now()}`;
      await promoService.createPromoCode({
        code: promoCode,
        discountType: 'percentage',
        discountValue: 20, // 20%
        validUntil: new Date(Date.now() + 86400000).toISOString(),
        eligibleCategories: ['plan'],
      });

      const items = [
        { catalogProductId: 'p1', category: 'plan', billingType: 'recurring', lineSubtotal: 20000 },
        { catalogProductId: 'p2', category: 'addon', billingType: 'one_time', lineSubtotal: 10000 },
      ];

      const res = await promoService.evaluatePromo({
        code: promoCode,
        currency: 'INR',
        items,
      });

      expect(res.discountType).toBe('percentage');
      expect(res.discountValue).toBe(20);
      expect(res.totalDiscount).toBe(4000); // 20% of 20000 plan only
      expect(res.lineDiscounts.get('p1')).toBe(4000);
      expect(res.lineDiscounts.get('p2')).toBeUndefined();
    });

    it('evaluates fixed monetary discount capped at eligible subtotal', async () => {
      if (!isDbAvailable) return;
      const promoCode = `FIXED_${Date.now()}`;
      await promoService.createPromoCode({
        code: promoCode,
        discountType: 'fixed',
        discountValue: 5000,
        currency: 'INR',
        validUntil: new Date(Date.now() + 86400000).toISOString(),
      });

      const items = [
        { catalogProductId: 'p1', category: 'plan', billingType: 'recurring', lineSubtotal: 10000 },
        { catalogProductId: 'p2', category: 'addon', billingType: 'one_time', lineSubtotal: 10000 },
      ];

      const res = await promoService.evaluatePromo({
        code: promoCode,
        currency: 'INR',
        items,
      });

      expect(res.discountType).toBe('fixed');
      expect(res.totalDiscount).toBe(5000);
      // Proportionally distributed: 2500 on p1, 2500 on p2
      expect(res.lineDiscounts.get('p1')).toBe(2500);
      expect(res.lineDiscounts.get('p2')).toBe(2500);
    });

    it('rejects expired, inactive, or currency-mismatched promo codes', async () => {
      if (!isDbAvailable) return;
      const expiredCode = `EXP_${Date.now()}`;
      await promoService.createPromoCode({
        code: expiredCode,
        discountType: 'percentage',
        discountValue: 10,
        validFrom: new Date(Date.now() - 20000).toISOString(),
        validUntil: new Date(Date.now() - 10000).toISOString(), // expired
      });

      await expect(
        promoService.evaluatePromo({
          code: expiredCode,
          currency: 'INR',
          items: [{ catalogProductId: 'p1', category: 'plan', billingType: 'recurring', lineSubtotal: 1000 }],
        }),
      ).rejects.toThrow();

      const inrOnlyCode = `INR_${Date.now()}`;
      await promoService.createPromoCode({
        code: inrOnlyCode,
        discountType: 'fixed',
        discountValue: 100,
        currency: 'INR',
        validUntil: new Date(Date.now() + 86400000).toISOString(),
      });

      await expect(
        promoService.evaluatePromo({
          code: inrOnlyCode,
          currency: 'USD',
          items: [{ catalogProductId: 'p1', category: 'plan', billingType: 'recurring', lineSubtotal: 1000 }],
        }),
      ).rejects.toThrow();
    });

    it('enforces atomic usage cap with row-level locking', async () => {
      if (!isDbAvailable) return;
      const capCode = `CAP_${Date.now()}`;
      const promo = await promoService.createPromoCode({
        code: capCode,
        discountType: 'fixed',
        discountValue: 500,
        currency: 'INR',
        maxUses: 1, // only 1 redemption allowed
        validUntil: new Date(Date.now() + 86400000).toISOString(),
      });

      // Insert a test quote for foreign key
      const qRes = await queryPlatform(
        `INSERT INTO app.quotes (
           quote_number, currency, status, subtotal, taxable_amount, grand_total,
           tax_classification, seller_jurisdiction, customer_jurisdiction,
           public_token_hash, expires_at, lead_id
         ) VALUES (
           $1, 'INR', 'draft', 1000, 1000, 1000,
           'export', '{"country":"IN"}'::jsonb, '{"country":"US"}'::jsonb,
           $2, clock_timestamp() + interval '14 days', $3
         ) RETURNING id`,
        [`Q-TEST-${Date.now()}`, crypto.randomBytes(32).toString('hex'), testLeadId],
      );
      const testQuoteId = qRes.rows[0].id;

      const client = await platformPool.connect();
      try {
        await client.query('BEGIN');
        await promoService.redeemPromoAtomic({
          client,
          promoCodeId: promo.id,
          quoteId: testQuoteId,
          discountApplied: 500,
        });
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

      // Second redemption must fail due to usage cap
      const client2 = await platformPool.connect();
      try {
        await client2.query('BEGIN');
        await expect(
          promoService.redeemPromoAtomic({
            client: client2,
            promoCodeId: promo.id,
            quoteId: testQuoteId,
            discountApplied: 500,
          }),
        ).rejects.toThrow();
        await client2.query('ROLLBACK');
      } finally {
        client2.release();
      }
    });

    it('enforces atomic usage cap under concurrent race conditions using separate connections', async () => {
      if (!isDbAvailable) return;
      const raceCode = `RACE_${Date.now()}`;
      const promo = await promoService.createPromoCode({
        code: raceCode,
        discountType: 'fixed',
        discountValue: 100,
        currency: 'INR',
        maxUses: 2, // Only 2 allowed!
        validUntil: new Date(Date.now() + 86400000).toISOString(),
      });

      // Create 5 distinct draft quotes for separate redemption foreign keys
      const quoteIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const qRes = await queryPlatform(
          `INSERT INTO app.quotes (
             quote_number, currency, status, subtotal, taxable_amount, grand_total,
             tax_classification, seller_jurisdiction, customer_jurisdiction,
             public_token_hash, expires_at, lead_id
           ) VALUES (
             $1, 'INR', 'draft', 1000, 1000, 1000,
             'inter_state', '{"country":"IN","state":"KA"}'::jsonb, '{"country":"IN","state":"DL"}'::jsonb,
             $2, clock_timestamp() + interval '14 days', $3
           ) RETURNING id`,
          [`Q-RACE-${Date.now()}-${i}`, crypto.randomBytes(32).toString('hex'), testLeadId],
        );
        quoteIds.push(qRes.rows[0].id);
      }

      // Spawn 5 simultaneous concurrent redemption attempts over separate connections
      const promises = quoteIds.map(async (quoteId) => {
        const client = await platformPool.connect();
        try {
          await client.query('BEGIN');
          await promoService.redeemPromoAtomic({
            client,
            promoCodeId: promo.id,
            quoteId,
            discountApplied: 100,
          });
          await client.query('COMMIT');
          return { success: true };
        } catch (err: any) {
          await client.query('ROLLBACK').catch(() => {});
          throw err;
        } finally {
          client.release();
        }
      });

      const outcomes = await Promise.allSettled(promises);
      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected');

      // Exactly max_uses (2) must succeed, exactly 3 must be rejected
      expect(fulfilled.length).toBe(2);
      expect(rejected.length).toBe(3);

      // Verify database state: current_uses must be exactly 2
      const promoCheck = await queryPlatform(
        `SELECT current_uses, max_uses FROM app.promo_codes WHERE id = $1`,
        [promo.id],
      );
      expect(promoCheck.rows[0].current_uses).toBe(2);

      // Verify app.promo_redemptions has exactly 2 rows
      const redCheck = await queryPlatform(
        `SELECT count(*) FROM app.promo_redemptions WHERE promo_code_id = $1`,
        [promo.id],
      );
      expect(parseInt(redCheck.rows[0].count, 10)).toBe(2);
    });
  });

  describe('3. Indian GST Calculation Engine', () => {
    it('calculates intra-state 9% CGST + 9% SGST accurately', () => {
      const res = gstService.calculateTax({
        currency: 'INR',
        sellerJurisdiction: { country: 'IN', state: 'KA' },
        customerJurisdiction: { country: 'IN', state: 'KA' },
        lines: [{ lineSubtotal: 10000, discountAmount: 1000 }],
      });

      expect(res.taxClassification).toBe('intra_state');
      expect(res.lines[0]?.taxType).toBe('cgst_sgst');
      expect(res.lines[0]?.taxableAmount).toBe(9000);
      expect(res.lines[0]?.cgstAmount).toBe(810); // 9% of 9000
      expect(res.lines[0]?.sgstAmount).toBe(810); // 9% of 9000
      expect(res.lines[0]?.taxAmount).toBe(1620);
      expect(res.lines[0]?.lineTotal).toBe(10620);
      expect(res.grandTotalTotal ?? (res.cgstTotal + res.sgstTotal + res.lines[0]?.taxableAmount)).toBe(10620);
    });

    it('calculates inter-state 18% IGST accurately', () => {
      const res = gstService.calculateTax({
        currency: 'INR',
        sellerJurisdiction: { country: 'IN', state: 'KA' },
        customerJurisdiction: { country: 'IN', state: 'MH' }, // Maharashtra != Karnataka
        lines: [{ lineSubtotal: 50000, discountAmount: 0 }],
      });

      expect(res.taxClassification).toBe('inter_state');
      expect(res.lines[0]?.taxType).toBe('igst');
      expect(res.lines[0]?.taxableAmount).toBe(50000);
      expect(res.lines[0]?.igstAmount).toBe(9000); // 18% of 50000
      expect(res.lines[0]?.taxAmount).toBe(9000);
      expect(res.lines[0]?.lineTotal).toBe(59000);
      expect(res.igstTotal).toBe(9000);
    });

    it('rejects international customer when export/LUT treatment is unconfigured (fail-closed)', () => {
      try {
        gstService.calculateTax({
          currency: 'USD',
          customerJurisdiction: { country: 'US', state: 'CA' },
          lines: [{ lineSubtotal: 1000, discountAmount: 0 }],
        });
        expect.unreachable();
      } catch (err: any) {
        expect(err.getResponse().code).toBe('INTERNATIONAL_TAX_CLASSIFICATION_REQUIRED');
      }
    });

    it('calculates zero-rated 0% GST for international customer when authorized LUT is configured', () => {
      const res = gstService.calculateTax({
        currency: 'USD',
        customerJurisdiction: { country: 'US', state: 'CA' },
        exportConfig: { treatment: 'zero_rated_lut', lutNumber: 'LUT-2026-27-0012' },
        lines: [{ lineSubtotal: 1200, discountAmount: 200 }],
      });

      expect(res.taxClassification).toBe('export');
      expect(res.lines[0]?.taxType).toBe('none');
      expect(res.lines[0]?.taxableAmount).toBe(1000);
      expect(res.lines[0]?.taxAmount).toBe(0);
      expect(res.lines[0]?.lineTotal).toBe(1000);
      expect(res.taxTotal).toBe(0);
    });

    it('calculates 18% IGST for international customer when standard_igst treatment is configured', () => {
      const res = gstService.calculateTax({
        currency: 'USD',
        customerJurisdiction: { country: 'US', state: 'NY' },
        exportConfig: { treatment: 'standard_igst' },
        lines: [{ lineSubtotal: 1000, discountAmount: 0 }],
      });

      expect(res.taxClassification).toBe('inter_state');
      expect(res.lines[0]?.taxType).toBe('igst');
      expect(res.lines[0]?.taxAmount).toBe(180);
      expect(res.taxTotal).toBe(180);
    });

    it('rejects Indian customer without state jurisdiction', () => {
      try {
        gstService.calculateTax({
          currency: 'INR',
          customerJurisdiction: { country: 'IN', state: '' },
          lines: [{ lineSubtotal: 1000, discountAmount: 0 }],
        });
        expect.unreachable();
      } catch (err: any) {
        expect(err.getResponse().detail).toContain('customer state code');
      }
    });

    it('validates configured seller jurisdiction and rejects missing or invalid configuration', () => {
      // Valid configured seller
      const valid = gstService.resolveSellerJurisdiction({
        country: 'IN',
        state: 'MH',
        city: 'Mumbai',
        pinCode: '400001',
      });
      expect(valid.state).toBe('MH');
      expect(valid.city).toBe('Mumbai');

      // Missing configuration
      const unconfiguredGst = new GstCalculatorService(undefined);
      expect(() => unconfiguredGst.resolveSellerJurisdiction(undefined)).toThrow();

      // Invalid configuration (empty state or invalid country)
      expect(() =>
        gstService.resolveSellerJurisdiction({
          country: 'IND', // invalid 3 chars
          state: 'KA',
          city: 'Bengaluru',
          pinCode: '560001',
        }),
      ).toThrow();
    });

    it('proves that missing seller configuration throws a clear error and cannot silently resolve to Karnataka', () => {
      // Service instantiated with empty config (no SELLER_COUNTRY or SELLER_STATE)
      const emptyConfigGst = new GstCalculatorService({} as any);

      // 1. Missing both country and state throws SELLER_JURISDICTION_CONFIG_MISSING
      try {
        emptyConfigGst.resolveSellerJurisdiction(undefined);
        expect.unreachable();
      } catch (err: any) {
        expect(err.getResponse().code).toBe('SELLER_JURISDICTION_CONFIG_MISSING');
        expect(err.getResponse().detail).toContain('SELLER_COUNTRY and SELLER_STATE server configuration are required');
      }

      // 2. Missing state (only country configured) throws SELLER_JURISDICTION_CONFIG_MISSING
      const countryOnlyGst = new GstCalculatorService({ SELLER_COUNTRY: 'IN' } as any);
      try {
        countryOnlyGst.resolveSellerJurisdiction(undefined);
        expect.unreachable();
      } catch (err: any) {
        expect(err.getResponse().code).toBe('SELLER_JURISDICTION_CONFIG_MISSING');
      }

      // 3. Tax calculation fails closed without silent Karnataka fallback
      try {
        emptyConfigGst.calculateTax({
          currency: 'INR',
          customerJurisdiction: { country: 'IN', state: 'KA' },
          lines: [{ lineSubtotal: 1000, discountAmount: 0 }],
        });
        expect.unreachable();
      } catch (err: any) {
        expect(err.getResponse().code).toBe('SELLER_JURISDICTION_CONFIG_MISSING');
      }
    });
  });

  describe('4. Quote Builder API & End-to-End Quotation Workflow', () => {
    let starterProduct: any;
    let customTemplateProduct: any;

    beforeAll(async () => {
      if (!isDbAvailable) return;
      // Fetch seeded products
      const catalog = await catalogService.listCatalog();
      starterProduct = catalog.find((p) => p.code === 'plan_starter_monthly');
      customTemplateProduct = catalog.find((p) => p.code === 'template_custom_build');

      // Verify sample catalog entries are inactive by default to protect production deployments
      expect(starterProduct.isActive).toBe(false);
      expect(customTemplateProduct.isActive).toBe(false);

      // Explicit platform administrator approval & activation before use
      starterProduct = await catalogService.setCatalogItemStatus(starterProduct.id, true);
      customTemplateProduct = await catalogService.setCatalogItemStatus(customTemplateProduct.id, true);

      // Create a test lead
      const email = `quote_prospect_${Date.now()}@example.com`;
      const leadRes = await queryPlatform(
        `INSERT INTO app.leads (email, name, company, stage)
         VALUES ($1, 'Quote Prospect', 'Initech Corp', 'meeting_held')
         RETURNING id`,
        [email],
      );
      testLeadId = leadRes.rows[0].id;
    });

    it('creates complete commercial quote for lead with itemized lines, GST and audit event', async () => {
      if (!isDbAvailable) return;

      const res = await quotesService.createQuote({
        dto: {
          leadId: testLeadId,
          currency: 'INR',
          customerJurisdiction: { country: 'IN', state: 'KA', city: 'Bengaluru' },
          items: [
            { catalogProductId: starterProduct.id, quantity: 1 },
            { catalogProductId: customTemplateProduct.id, quantity: 1 },
          ],
          notes: 'Special introductory package for Initech',
        },
        userId: '00000000-0000-0000-0000-000000000099',
        userRole: 'platform_admin',
        ip: '127.0.0.1',
      });

      expect(res.quote).toBeDefined();
      expect(res.quote.quoteNumber).toMatch(/^Q-\d{6}-\d{4}$/);
      expect(res.quote.leadId).toBe(testLeadId);
      expect(res.quote.currency).toBe('INR');
      expect(res.quote.status).toBe('issued');
      expect(res.publicToken).toBeDefined();
      expect(res.publicToken.length).toBe(64); // 32-byte hex
      expect(res.publicUrl).toBe(`/quotes/${res.publicToken}`);

      // Verify subtotals: 19999 + 75000 = 94999
      expect(res.quote.subtotal).toBe(94999);
      expect(res.quote.taxClassification).toBe('intra_state');
      // 9% CGST + 9% SGST = 18% of 94999 = 17099.82
      expect(res.quote.cgstTotal).toBe(8549.91);
      expect(res.quote.sgstTotal).toBe(8549.91);
      expect(res.quote.taxTotal).toBe(17099.82);
      expect(res.quote.grandTotal).toBe(112098.82);

      // Verify Lead stage was transitioned to 'quoted'
      const leadCheck = await queryPlatform(
        `SELECT stage FROM app.leads WHERE id = $1`,
        [testLeadId],
      );
      expect(leadCheck.rows[0].stage).toBe('quoted');

      // Verify token hash is stored, not raw token
      const rawHash = crypto.createHash('sha256').update(res.publicToken).digest('hex');
      const dbQuote = await queryPlatform(
        `SELECT public_token_hash FROM app.quotes WHERE id = $1`,
        [res.quote.id],
      );
      expect(dbQuote.rows[0].public_token_hash).toBe(rawHash);

      // Verify quote can be resolved by public access token
      const tokenQuote = await quotesService.getQuoteByToken(res.publicToken);
      expect(tokenQuote).toBeDefined();
      expect(tokenQuote?.id).toBe(res.quote.id);

      // Verify audit event in audit.events
      const auditCheck = await queryPlatform(
        `SELECT * FROM audit.events WHERE entity = 'quote' AND entity_id = $1`,
        [res.quote.id],
      );
      expect(auditCheck.rows.length).toBe(1);
      expect(auditCheck.rows[0].action).toBe('quote.issued');
    });

    it('applies promo code and redeems atomically during quote issuance', async () => {
      if (!isDbAvailable) return;
      const promoCode = `SALE10_${Date.now()}`;
      await promoService.createPromoCode({
        code: promoCode,
        discountType: 'percentage',
        discountValue: 10,
        validUntil: new Date(Date.now() + 86400000).toISOString(),
      });

      const res = await quotesService.createQuote({
        dto: {
          leadId: testLeadId,
          currency: 'INR',
          customerJurisdiction: { country: 'IN', state: 'DL' }, // Delhi = Inter-state (IGST)
          items: [{ catalogProductId: starterProduct.id, quantity: 1 }],
          promoCode,
        },
      });

      expect(res.quote.subtotal).toBe(19999);
      // 10% discount on 19999 = 1999.90
      expect(res.quote.discountTotal).toBe(1999.9);
      expect(res.quote.taxableAmount).toBe(17999.1);
      // 18% IGST on 17999.10 = 3239.84
      expect(res.quote.taxClassification).toBe('inter_state');
      expect(res.quote.igstTotal).toBe(3239.84);
      expect(res.quote.grandTotal).toBe(21238.94);

      // Verify promo redemption record
      const redCheck = await queryPlatform(
        `SELECT * FROM app.promo_redemptions WHERE quote_id = $1`,
        [res.quote.id],
      );
      expect(redCheck.rows.length).toBe(1);
      expect(parseFloat(redCheck.rows[0].discount_applied)).toBe(1999.9);
    });

    it('rejects quote creation when customer reference is invalid', async () => {
      if (!isDbAvailable) return;
      // Neither lead nor org
      await expect(
        quotesService.createQuote({
          dto: {
            currency: 'INR',
            customerJurisdiction: { country: 'IN', state: 'KA' },
            items: [{ catalogProductId: starterProduct.id, quantity: 1 }],
          } as any,
        }),
      ).rejects.toThrow();

      // Both lead and org
      await expect(
        quotesService.createQuote({
          dto: {
            leadId: testLeadId,
            orgId: '00000000-0000-0000-0000-000000000001',
            currency: 'INR',
            customerJurisdiction: { country: 'IN', state: 'KA' },
            items: [{ catalogProductId: starterProduct.id, quantity: 1 }],
          } as any,
        }),
      ).rejects.toThrow();
    });

    it('enforces immutability on issued quote financial snapshots', async () => {
      if (!isDbAvailable) return;
      const res = await quotesService.createQuote({
        dto: {
          leadId: testLeadId,
          currency: 'INR',
          customerJurisdiction: { country: 'IN', state: 'KA' },
          items: [{ catalogProductId: starterProduct.id, quantity: 1 }],
        },
      });

      // Attempting to mutate grand_total on an issued quote must be rejected by trigger trg_issued_quote_immutability
      await expect(
        queryPlatform(
          `UPDATE app.quotes SET grand_total = 1.00 WHERE id = $1`,
          [res.quote.id],
        ),
      ).rejects.toThrow(/immutable/i);

      // Attempting to modify quote lines on an issued quote must be rejected by trg_block_quote_line_modification
      await expect(
        queryPlatform(
          `DELETE FROM app.quote_lines WHERE quote_id = $1`,
          [res.quote.id],
        ),
      ).rejects.toThrow(/cannot be inserted, updated or deleted/i);
    });

    it('enforces RLS: tenant role (hs_app) cannot access platform lead quotes', async () => {
      if (!isDbAvailable) return;
      const res = await quotesService.createQuote({
        dto: {
          leadId: testLeadId,
          currency: 'INR',
          customerJurisdiction: { country: 'IN', state: 'KA' },
          items: [{ catalogProductId: starterProduct.id, quantity: 1 }],
        },
      });

      const appClient = await appPool.connect();
      try {
        // Since lead-linked quotes have org_id IS NULL, hs_app must see 0 rows
        const check = await appClient.query(
          `SELECT count(*) FROM app.quotes WHERE id = $1`,
          [res.quote.id],
        );
        expect(parseInt(check.rows[0].count, 10)).toBe(0);
      } finally {
        appClient.release();
      }
    });

    it('resolves active catalog price dynamically and enforces that price updates affect only future quotes', async () => {
      if (!isDbAvailable) return;
      // 1. Create a dynamic product with initial price 10,000 INR
      const code = `dyn_quote_${Date.now()}`;
      const dynProduct = await catalogService.createCatalogItem({
        code,
        name: 'Dynamic Pricing Assessment Package',
        category: 'custom_template',
        currency: 'INR',
        unitPrice: 10000,
        billingType: 'one_time',
      });

      // 2. Issue quote Q1 using the initial price
      const q1 = await quotesService.createQuote({
        dto: {
          leadId: testLeadId,
          currency: 'INR',
          customerJurisdiction: { country: 'IN', state: 'KA' },
          items: [{ catalogProductId: dynProduct.id, quantity: 1 }],
        },
      });

      expect(q1.quote.subtotal).toBe(10000);
      expect(q1.quote.lines[0]?.unitPrice).toBe(10000);
      expect(q1.quote.grandTotal).toBe(11800); // 10000 + 18% GST

      // 3. Dynamically update product price in catalog to 15,000 INR
      await catalogService.updateCatalogItem(dynProduct.id, {
        unitPrice: 15000,
      });

      // 4. Verify Q1 retains immutable snapshot of the original 10,000 price
      const q1Reload = await quotesService.getQuoteById(q1.quote.id);
      expect(q1Reload?.subtotal).toBe(10000);
      expect(q1Reload?.lines[0]?.unitPrice).toBe(10000);
      expect(q1Reload?.grandTotal).toBe(11800);

      // 5. Issue quote Q2 - must dynamically pick up the new 15,000 price
      const q2 = await quotesService.createQuote({
        dto: {
          leadId: testLeadId,
          currency: 'INR',
          customerJurisdiction: { country: 'IN', state: 'KA' },
          items: [{ catalogProductId: dynProduct.id, quantity: 1 }],
        },
      });

      expect(q2.quote.subtotal).toBe(15000);
      expect(q2.quote.lines[0]?.unitPrice).toBe(15000);
      expect(q2.quote.grandTotal).toBe(17700); // 15000 + 18% GST
    });

    it('rejects quote creation for inactive or deactivated catalog products', async () => {
      if (!isDbAvailable) return;
      // 1. Create a product and immediately deactivate it
      const code = `inactive_p_${Date.now()}`;
      const product = await catalogService.createCatalogItem({
        code,
        name: 'Retired Assessment Plan',
        category: 'plan',
        currency: 'INR',
        unitPrice: 12000,
        billingType: 'recurring',
        billingInterval: 'month',
        isActive: false,
      });

      // 2. Attempting to create a quote with inactive product must fail with 422 PRODUCT_INACTIVE
      try {
        await quotesService.createQuote({
          dto: {
            leadId: testLeadId,
            currency: 'INR',
            customerJurisdiction: { country: 'IN', state: 'KA' },
            items: [{ catalogProductId: product.id, quantity: 1 }],
          },
        });
        expect.unreachable();
      } catch (err: any) {
        expect(err.getResponse().code).toBe('PRODUCT_INACTIVE');
      }

      // 3. Reactivate product and verify quote creation now succeeds
      await catalogService.setCatalogItemStatus(product.id, true);

      const activeQuote = await quotesService.createQuote({
        dto: {
          leadId: testLeadId,
          currency: 'INR',
          customerJurisdiction: { country: 'IN', state: 'KA' },
          items: [{ catalogProductId: product.id, quantity: 1 }],
        },
      });
      expect(activeQuote.quote.id).toBeDefined();
    });
  });
});
