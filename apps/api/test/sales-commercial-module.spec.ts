import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GstCalculatorService } from '../src/modules/quotes/gst-calculator.service.js';
import { PricingCatalogService } from '../src/modules/quotes/pricing-catalog.service.js';
import { PromoCodesService } from '../src/modules/quotes/promo-codes.service.js';
import { QuotesService } from '../src/modules/quotes/quotes.service.js';
import { FakeEmailSender } from '@hs/adapters';

function expectProblem(promise: Promise<any>, status: number, code?: string) {
  return expect(promise).rejects.toSatisfy((err: any) => {
    const errStatus = typeof err?.getStatus === 'function' ? err.getStatus() : err?.status;
    const response = typeof err?.getResponse === 'function' ? err.getResponse() : err;
    const errCode = response?.code || err?.code;
    return errStatus === status && (!code || errCode === code);
  });
}

describe('Sales & Commercial Management Module (End-to-End Tests)', () => {
  let platformPool: pg.Pool;
  let catalogService: PricingCatalogService;
  let promoService: PromoCodesService;
  let gstService: GstCalculatorService;
  let quotesService: QuotesService;
  let fakeEmailSender: FakeEmailSender;
  let testLeadId: string;
  let testLeadBId: string;
  let testOrgAId: string;
  let testOrgBId: string;
  let testProductId: string;
  let isDbAvailable = false;

  beforeAll(async () => {
    gstService = new GstCalculatorService({
      SELLER_COUNTRY: 'IN',
      SELLER_STATE: 'KA',
      SELLER_CITY: 'Bengaluru',
      SELLER_PIN_CODE: '560001',
    } as any);

    fakeEmailSender = new FakeEmailSender();

    const platformUrl =
      process.env.TEST_DB_PLATFORM_URL ||
      process.env.DATABASE_PLATFORM_URL ||
      'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart_test';

    platformPool = new pg.Pool({ connectionString: platformUrl, max: 10 });

    try {
      const client = await platformPool.connect();
      await client.query('SELECT 1');
      await client.query("SELECT set_config('app.is_platform', 'true', false)");

      // Ensure a creator user exists for organizations.created_by
      let creatorId = '00000000-0000-4000-8000-000000000001';
      const uRes = await client.query(`SELECT id FROM app.users WHERE id = $1`, [creatorId]);
      if (uRes.rows.length === 0) {
        const anyUser = await client.query(`SELECT id FROM app.users LIMIT 1`);
        if (anyUser.rows.length > 0) {
          creatorId = anyUser.rows[0].id;
        } else {
          await client.query(
            `INSERT INTO app.users (id, email, name, role, status)
             VALUES ($1, 'platform.admin@test.local', 'Platform Admin', 'platform_admin', 'active')
             ON CONFLICT DO NOTHING`,
            [creatorId],
          );
        }
      }

      // Create two distinct test organizations for strict tenant isolation testing
      const orgARes = await client.query(
        `INSERT INTO app.organizations (name, slug, status, created_by)
         VALUES ($1, $2, 'paid_active', $3)
         RETURNING id`,
        [`Org A ${Date.now()}`, `org-a-${Date.now()}`, creatorId],
      );
      testOrgAId = orgARes.rows[0].id;

      // Create company_admin user for Org A so recipientEmail can be resolved
      await client.query(
        `INSERT INTO app.users (org_id, email, name, role, status)
         VALUES ($1, $2, 'Org A Admin', 'company_admin', 'active')`,
        [testOrgAId, `admin_orga_${Date.now()}@orga.test`],
      );

      const orgBRes = await client.query(
        `INSERT INTO app.organizations (name, slug, status, created_by)
         VALUES ($1, $2, 'paid_active', $3)
         RETURNING id`,
        [`Org B ${Date.now()}`, `org-b-${Date.now()}`, creatorId],
      );
      testOrgBId = orgBRes.rows[0].id;

      // Create test lead associated with Org A
      const lRes = await client.query(
        `INSERT INTO app.leads (org_id, email, name, company, stage)
         VALUES ($1, $2, 'Acme Buyer', 'Acme Corporation', 'meeting_booked')
         RETURNING id`,
        [testOrgAId, `lead_sales_${Date.now()}@acme.com`],
      );
      testLeadId = lRes.rows[0].id;

      // Add a test booking for lead A
      await client.query(
        `INSERT INTO app.lead_bookings (lead_id, calcom_booking_id, uid, title, start_time, end_time, status)
         VALUES ($1, 'cal_123', $2, 'Discovery Call', now(), now() + interval '30 minutes', 'ACCEPTED')`,
        [testLeadId, `uid_${Date.now()}`],
      );

      // Create test lead associated with Org B
      const lBRes = await client.query(
        `INSERT INTO app.leads (org_id, email, name, company, stage)
         VALUES ($1, $2, 'Beta Buyer', 'Beta Ltd', 'meeting_booked')
         RETURNING id`,
        [testOrgBId, `lead_beta_${Date.now()}@beta.com`],
      );
      testLeadBId = lBRes.rows[0].id;

      client.release();
      isDbAvailable = true;

      catalogService = new PricingCatalogService(platformPool);
      promoService = new PromoCodesService(platformPool);

      quotesService = new QuotesService(
        platformPool,
        undefined,
        catalogService,
        promoService,
        gstService,
        undefined, // Redis optional in unit test
        fakeEmailSender as any,
      );

      // Ensure active product exists
      const catProduct = await catalogService.createCatalogItem({
        code: `PROD_TEST_${Date.now()}`,
        name: 'Evaluation Blueprint Pack',
        category: 'addon',
        currency: 'INR',
        unitPrice: 20000,
        billingType: 'one_time',
      });
      testProductId = catProduct.id;
      await catalogService.setCatalogItemStatus(testProductId, true);
    } catch (err: any) {
      console.warn('Database not available for sales module tests:', err.message);
    }
  });

  afterAll(async () => {
    if (platformPool) {
      await platformPool.end().catch(() => {});
    }
  });

  describe('1. Leads & Bookings Ingestion & Querying', () => {
    it('lists sales leads with active booking metadata', async () => {
      if (!isDbAvailable) return;

      const leads = await quotesService.listLeads();
      expect(Array.isArray(leads)).toBe(true);
      expect(leads.length).toBeGreaterThan(0);

      const found = leads.find((l) => l.id === testLeadId);
      expect(found).toBeDefined();
      expect(found.email).toContain('lead_sales_');
      expect(found.stage).toBe('meeting_booked');
    });

    it('retrieves single lead with complete booking history', async () => {
      if (!isDbAvailable) return;

      const lead = await quotesService.getLeadById(testLeadId);
      expect(lead).toBeDefined();
      expect(lead.id).toBe(testLeadId);
      expect(Array.isArray(lead.bookings)).toBe(true);
      expect(lead.bookings.length).toBeGreaterThan(0);
      expect(lead.bookings[0].title).toBe('Discovery Call');
    });
  });

  describe('2. Pricing Catalog CRUD & Activation Safeguards', () => {
    it('creates, activates, and deactivates catalog products', async () => {
      if (!isDbAvailable) return;

      const code = `CAT_${Date.now()}`;
      const item = await catalogService.createCatalogItem({
        code,
        name: 'Enterprise Onboarding',
        category: 'addon',
        currency: 'INR',
        unitPrice: 50000,
        billingType: 'one_time',
      });

      expect(item.code).toBe(code);
      expect(item.isActive).toBe(true);

      const deactivated = await catalogService.setCatalogItemStatus(item.id, false);
      expect(deactivated.isActive).toBe(false);

      const activated = await catalogService.setCatalogItemStatus(item.id, true);
      expect(activated.isActive).toBe(true);
    });

    it('updates catalog product pricing and details', async () => {
      if (!isDbAvailable) return;

      const updated = await catalogService.updateCatalogItem(testProductId, {
        unitPrice: 22000,
        name: 'Evaluation Blueprint Pack (Updated)',
      });

      expect(updated.unitPrice).toBe(22000);
      expect(updated.name).toBe('Evaluation Blueprint Pack (Updated)');
    });
  });

  describe('3. Promo Code Engine', () => {
    it('creates promo codes with usage limits and discount values', async () => {
      if (!isDbAvailable) return;

      const code = `PROMO_${Date.now()}`;
      const promo = await promoService.createPromoCode({
        code,
        description: 'Design Partner Discount',
        discountType: 'percentage',
        discountValue: 15,
        maxUses: 50,
        validUntil: new Date(Date.now() + 86400000).toISOString(),
      });

      expect(promo.code).toBe(code);
      expect(promo.discountValue).toBe(15);
      expect(promo.maxUses).toBe(50);
      expect(promo.isActive).toBe(true);
    });
  });

  describe('4. GST Engine Calculation', () => {
    it('computes Intra-state Karnataka supply as CGST 9% + SGST 9%', () => {
      const result = gstService.calculateTax({
        currency: 'INR',
        customerJurisdiction: { country: 'IN', state: 'KA' },
        lines: [{ lineSubtotal: 10000, discountAmount: 1000 }],
      });

      expect(result.taxClassification).toBe('intra_state');
      expect(result.lines[0].taxableAmount).toBe(9000);
      expect(result.cgstTotal).toBe(810);
      expect(result.sgstTotal).toBe(810);
      expect(result.igstTotal).toBe(0);
      expect(result.taxTotal).toBe(1620);
    });

    it('computes Inter-state supply as IGST 18%', () => {
      const result = gstService.calculateTax({
        currency: 'INR',
        customerJurisdiction: { country: 'IN', state: 'MH' },
        lines: [{ lineSubtotal: 20000, discountAmount: 0 }],
      });

      expect(result.taxClassification).toBe('inter_state');
      expect(result.lines[0].taxableAmount).toBe(20000);
      expect(result.cgstTotal).toBe(0);
      expect(result.sgstTotal).toBe(0);
      expect(result.igstTotal).toBe(3600);
      expect(result.taxTotal).toBe(3600);
    });
  });

  describe('5. Quote Generation & Customer Email Workflow', () => {
    let createdQuoteId: string;
    let quoteToken: string;

    it('creates a commercial quote with itemized lines, frozen financials, and encrypted token in DB', async () => {
      if (!isDbAvailable) return;

      const result = await quotesService.createQuote({
        dto: {
          leadId: testLeadId,
          currency: 'INR',
          customerJurisdiction: { country: 'IN', state: 'KA', city: 'Bengaluru', pinCode: '560001' },
          items: [{ catalogProductId: testProductId, quantity: 2 }],
        },
        userId: null,
        userRole: 'platform_admin',
      });

      expect(result.quote).toBeDefined();
      expect(result.quote.quoteNumber).toMatch(/^Q-\d{6}-\d{4}$/);
      expect(result.publicToken).toBeDefined();
      expect(result.publicUrl).toBe(`/quotes/${result.publicToken}`);
      expect(result.quote.taxClassification).toBe('intra_state');

      // Verify encrypted_token column is populated in PostgreSQL
      const client = await platformPool.connect();
      try {
        await client.query("SELECT set_config('app.is_platform', 'true', false)");
        const dbRes = await client.query(
          `SELECT public_token_hash, encrypted_token FROM app.quotes WHERE id = $1`,
          [result.quote.id],
        );
        expect(dbRes.rows.length).toBe(1);
        expect(dbRes.rows[0].encrypted_token).toBeDefined();
        expect(dbRes.rows[0].encrypted_token).toContain(':'); // IV:Tag:Ciphertext
      } finally {
        client.release();
      }

      createdQuoteId = result.quote.id;
      quoteToken = result.publicToken;
    });

    it('sends customer review email with quote review link and logs token-free audit event', async () => {
      if (!isDbAvailable) return;

      const sendResult = await quotesService.sendQuoteEmail({
        quoteId: createdQuoteId,
        publicToken: quoteToken,
        actorId: null,
        actorRole: 'platform_admin',
      });

      expect(sendResult.success).toBe(true);
      expect(sendResult.recipientEmail).toContain('@acme.com');
      expect(sendResult.quoteNumber).toMatch(/^Q-\d{6}-\d{4}$/);

      // Verify email was captured in fake email sender
      const sent = fakeEmailSender.getLastEmail();
      expect(sent).toBeDefined();
      expect(sent?.to).toBe(sendResult.recipientEmail);
      expect(sent?.template).toBe('quote_review');
      expect(sent?.vars.publicUrl).toContain(`/quotes/${quoteToken}`);

      // Inspect audit log: verify raw token and publicUrl are NEVER recorded
      const client = await platformPool.connect();
      try {
        await client.query("SELECT set_config('app.is_platform', 'true', false)");
        const auditRes = await client.query(
          `SELECT * FROM audit.events WHERE entity = 'quote' AND entity_id = $1 AND action = 'quote.sent' ORDER BY id DESC LIMIT 1`,
          [createdQuoteId],
        );
        expect(auditRes.rows.length).toBe(1);
        const auditRow = auditRes.rows[0];
        const afterPayload = auditRow.after;

        // Security assertion: NO bearer token or token-bearing URL
        expect(afterPayload.publicUrl).toBeUndefined();
        expect(afterPayload.publicToken).toBeUndefined();
        expect(afterPayload.token).toBeUndefined();
        expect(JSON.stringify(afterPayload)).not.toContain(quoteToken);

        // Required non-sensitive delivery metadata
        expect(afterPayload.quoteNumber).toMatch(/^Q-\d{6}-\d{4}$/);
        expect(afterPayload.recipientEmail).toContain('@acme.com');
        expect(afterPayload.sentAt).toBeDefined();
        expect(afterPayload.deliveryStatus).toBe('accepted_by_provider');
        expect(afterPayload.providerMessageId).toBeDefined();
      } finally {
        client.release();
      }
    });

    it('allows customer to review and accept the quotation via one-click approval', async () => {
      if (!isDbAvailable) return;

      // Customer reviews quote (GET /quotes/:token)
      const customerQuote = await quotesService.getQuoteByToken(quoteToken);
      expect(customerQuote).toBeDefined();
      expect(customerQuote?.quoteNumber).toMatch(/^Q-\d{6}-\d{4}$/);
      expect(customerQuote?.status).toBe('issued');

      // Customer accepts quote (POST /quotes/:token/accept)
      const acceptResult = await quotesService.acceptQuote({
        token: quoteToken,
        acceptedByName: 'Jane Doe, CFO',
        confirmationAcknowledged: true,
        clientIp: null, // PHS-I128 boundary safe
        userAgent: 'Mozilla/5.0 Test Browser',
      });

      expect(acceptResult.success).toBe(true);
      expect(acceptResult.quote.status).toBe('accepted');
      expect(acceptResult.quote.acceptedByName).toBe('Jane Doe, CFO');

      // Verify re-acceptance is idempotent
      const reAcceptResult = await quotesService.acceptQuote({
        token: quoteToken,
        confirmationAcknowledged: true,
      });
      expect(reAcceptResult.success).toBe(true);
      expect(reAcceptResult.alreadyAccepted).toBe(true);
    });
  });

  describe('6. Strict Tenant Isolation & Cross-Tenant Access Control', () => {
    let quoteForOrgAId: string;
    let quoteTokenA: string;

    beforeAll(async () => {
      if (!isDbAvailable) return;

      const res = await quotesService.createQuote({
        dto: {
          orgId: testOrgAId,
          currency: 'INR',
          customerJurisdiction: { country: 'IN', state: 'KA' },
          items: [{ catalogProductId: testProductId, quantity: 1 }],
        },
        userId: null,
        userRole: 'platform_admin',
      });
      quoteForOrgAId = res.quote.id;
      quoteTokenA = res.publicToken;
    });

    it('scopes quote listing by org_id for company admins', async () => {
      if (!isDbAvailable) return;

      const orgBQuotes = await quotesService.listQuotes({ orgId: testOrgBId });
      const foundInOrgB = orgBQuotes.find((q) => q.id === quoteForOrgAId);
      expect(foundInOrgB).toBeUndefined();

      const orgAQuotes = await quotesService.listQuotes({ orgId: testOrgAId });
      const foundInOrgA = orgAQuotes.find((q) => q.id === quoteForOrgAId);
      expect(foundInOrgA).toBeDefined();
    });

    it('blocks cross-tenant quote read via getQuoteById (returns null / 404)', async () => {
      if (!isDbAvailable) return;

      // When queried with matching orgId, returns quote
      const ownQuote = await quotesService.getQuoteById(quoteForOrgAId, testOrgAId);
      expect(ownQuote).toBeDefined();
      expect(ownQuote?.id).toBe(quoteForOrgAId);

      // When queried with cross-tenant orgId, returns null (translating to 404 in controller)
      const crossTenantQuote = await quotesService.getQuoteById(quoteForOrgAId, testOrgBId);
      expect(crossTenantQuote).toBeNull();
    });

    it('blocks cross-tenant sendQuoteEmail with 404', async () => {
      if (!isDbAvailable) return;

      await expectProblem(
        quotesService.sendQuoteEmail({
          quoteId: quoteForOrgAId,
          orgId: testOrgBId, // Mismatched tenant
          publicToken: quoteTokenA,
        }),
        404,
        'QUOTE_NOT_FOUND',
      );
    });

    it('blocks cross-tenant lead read via getLeadById (returns null / 404)', async () => {
      if (!isDbAvailable) return;

      // Lead A belongs to Org A
      const ownLead = await quotesService.getLeadById(testLeadId, testOrgAId);
      expect(ownLead).toBeDefined();
      expect(ownLead.id).toBe(testLeadId);

      // Mismatched Org B cannot read Lead A
      const crossLead = await quotesService.getLeadById(testLeadId, testOrgBId);
      expect(crossLead).toBeNull();
    });

    it('scopes lead listing by org_id', async () => {
      if (!isDbAvailable) return;

      const orgBLeads = await quotesService.listLeads({ orgId: testOrgBId });
      expect(orgBLeads.some((l) => l.id === testLeadId)).toBe(false);
      expect(orgBLeads.some((l) => l.id === testLeadBId)).toBe(true);
    });
  });

  describe('7. Token Security, Constant-Time Comparison & Resend Durability', () => {
    let quoteForResendId: string;
    let validToken: string;

    beforeAll(async () => {
      if (!isDbAvailable) return;

      const res = await quotesService.createQuote({
        dto: {
          orgId: testOrgAId,
          currency: 'INR',
          customerJurisdiction: { country: 'IN', state: 'KA' },
          items: [{ catalogProductId: testProductId, quantity: 1 }],
        },
        userId: null,
        userRole: 'platform_admin',
      });
      quoteForResendId = res.quote.id;
      validToken = res.publicToken;
    });

    it('rejects tampered / mismatched publicToken in constant-time with 422', async () => {
      if (!isDbAvailable) return;

      const forgedToken = crypto.randomBytes(32).toString('hex');
      await expectProblem(
        quotesService.sendQuoteEmail({
          quoteId: quoteForResendId,
          orgId: testOrgAId,
          publicToken: forgedToken,
        }),
        422,
        'QUOTE_TOKEN_MISMATCH',
      );
    });

    it('successfully resends quote by decrypting encrypted_token without requiring publicToken from client', async () => {
      if (!isDbAvailable) return;

      // Call sendQuoteEmail WITHOUT publicToken (simulating admin dashboard resend button)
      const resendResult = await quotesService.sendQuoteEmail({
        quoteId: quoteForResendId,
        orgId: testOrgAId,
        // publicToken omitted!
      });

      expect(resendResult.success).toBe(true);
      expect(resendResult.recipientEmail).toBeDefined();

      const sent = fakeEmailSender.getLastEmail();
      expect(sent?.vars.publicUrl).toContain(`/quotes/${validToken}`);
    });
  });

  describe('8. Email Provider Failures & Production HTTPS Guards', () => {
    let testQuoteId: string;

    beforeAll(async () => {
      if (!isDbAvailable) return;

      const res = await quotesService.createQuote({
        dto: {
          orgId: testOrgAId,
          currency: 'INR',
          customerJurisdiction: { country: 'IN', state: 'KA' },
          items: [{ catalogProductId: testProductId, quantity: 1 }],
        },
        userId: null,
        userRole: 'platform_admin',
      });
      testQuoteId = res.quote.id;
    });

    it('returns 503 EMAIL_SERVICE_UNAVAILABLE when emailSender is missing', async () => {
      if (!isDbAvailable) return;

      const serviceWithoutEmail = new QuotesService(
        platformPool,
        undefined,
        catalogService,
        promoService,
        gstService,
        undefined,
        null, // No email sender
      );

      await expectProblem(
        serviceWithoutEmail.sendQuoteEmail({
          quoteId: testQuoteId,
          orgId: testOrgAId,
        }),
        503,
        'EMAIL_SERVICE_UNAVAILABLE',
      );
    });

    it('returns 502 EMAIL_DELIVERY_FAILED when provider rejects, and records NO quote.sent audit event', async () => {
      if (!isDbAvailable) return;

      const failingEmailSender = {
        send: async () => {
          throw new Error('SMTP connection timed out to upstream gateway');
        },
      };

      const serviceWithFailingEmail = new QuotesService(
        platformPool,
        undefined,
        catalogService,
        promoService,
        gstService,
        undefined,
        failingEmailSender as any,
      );

      // Verify throws 502
      await expectProblem(
        serviceWithFailingEmail.sendQuoteEmail({
          quoteId: testQuoteId,
          orgId: testOrgAId,
        }),
        502,
        'EMAIL_DELIVERY_FAILED',
      );

      // Verify NO quote.sent audit event was recorded for this failure
      const client = await platformPool.connect();
      try {
        await client.query("SELECT set_config('app.is_platform', 'true', false)");
        const auditRes = await client.query(
          `SELECT * FROM audit.events WHERE entity = 'quote' AND entity_id = $1 AND action = 'quote.sent'`,
          [testQuoteId],
        );
        expect(auditRes.rows.length).toBe(0);
      } finally {
        client.release();
      }
    });

    it('fails closed with 500 when APP_BASE_URL is not HTTPS in production', async () => {
      if (!isDbAvailable) return;

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const insecureService = new QuotesService(
        platformPool,
        { APP_BASE_URL: 'http://insecure-domain.com' } as any,
        catalogService,
        promoService,
        gstService,
        undefined,
        fakeEmailSender as any,
      );

      try {
        await expectProblem(
          insecureService.sendQuoteEmail({
            quoteId: testQuoteId,
            orgId: testOrgAId,
          }),
          500,
          'INSECURE_APP_ORIGIN',
        );
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
