import crypto from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GstCalculatorService } from '../src/modules/quotes/gst-calculator.service.js';
import { PricingCatalogService } from '../src/modules/quotes/pricing-catalog.service.js';
import { PromoCodesService } from '../src/modules/quotes/promo-codes.service.js';
import { QuotesService } from '../src/modules/quotes/quotes.service.js';
import { CustomerQuotesController } from '../src/modules/quotes/customer-quotes.controller.js';

describe('S1-T09-3 / PHS-I128: Customer Quote Review Screen & One-Click Approval (SP-010)', () => {
  let platformPool: pg.Pool;
  let catalogService: PricingCatalogService;
  let promoService: PromoCodesService;
  let gstService: GstCalculatorService;
  let quotesService: QuotesService;
  let customerController: CustomerQuotesController;
  let testLeadId: string;
  let activeProductId: string;
  let isDbAvailable = false;

  beforeAll(async () => {
    const platformUrl =
      process.env.DATABASE_PLATFORM_URL ||
      'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart';

    platformPool = new pg.Pool({ connectionString: platformUrl, max: 10 });
    platformPool.on('connect', (client) => {
      client.query("SELECT set_config('app.is_platform', 'true', false)");
    });

    try {
      const client = await platformPool.connect();
      await client.query('SELECT 1');
      await client.query("SELECT set_config('app.is_platform', 'true', false)");

      // Create test lead for quote assignment
      const lRes = await client.query(
        `INSERT INTO app.leads (email, name, company, stage)
         VALUES ($1, 'Quote Customer', 'Acme Corporation', 'meeting_held')
         RETURNING id`,
        [`lead_t09_3_${Date.now()}@example.com`],
      );
      testLeadId = lRes.rows[0].id;

      // Ensure active test product exists
      const pRes = await client.query(
        `INSERT INTO app.pricing_catalog
         (code, name, description, category, currency, unit_price, billing_type, billing_interval, is_active)
         VALUES ($1, 'Growth Assessment Tier', 'Monthly active candidate tier', 'plan', 'INR', 15000.00, 'recurring', 'month', true)
         ON CONFLICT (code) DO UPDATE SET is_active = true, unit_price = 15000.00
         RETURNING id`,
        [`prod_growth_${Date.now()}`],
      );
      activeProductId = pRes.rows[0].id;

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

    gstService = new GstCalculatorService(mockConfig);
    catalogService = new PricingCatalogService(platformPool);
    promoService = new PromoCodesService(platformPool);
    quotesService = new QuotesService(platformPool, mockConfig, catalogService, promoService, gstService);
    customerController = new CustomerQuotesController(quotesService);
  });

  afterAll(async () => {
    if (platformPool) {
      await platformPool.end();
    }
  });

  // Helper to create a fresh issued quote
  async function createTestQuote(options?: { expiresInDays?: number }) {
    return quotesService.createQuote({
      dto: {
        leadId: testLeadId,
        currency: 'INR',
        customerJurisdiction: {
          country: 'IN',
          state: 'KA',
          city: 'Bengaluru',
          pinCode: '560002',
          gstin: '29XYZAB5678C1Z2',
        },
        items: [{ catalogProductId: activeProductId, quantity: 1 }],
        notes: 'Terms: 14 days validity. Net 30 payment.',
        expiresInDays: options?.expiresInDays ?? 14,
      },
      userId: '00000000-0000-0000-0000-000000000001',
      userRole: 'platform_admin',
    });
  }

  describe('1. Customer Quote Review (GET /quotes/:token)', () => {
    it('retrieves issued quote details using the cryptographic public access token', async () => {
      if (!isDbAvailable) return;

      const created = await createTestQuote();
      expect(created.publicToken).toBeDefined();
      expect(created.publicToken.length).toBe(64); // 32-byte hex

      const quote = await quotesService.getQuoteByToken(created.publicToken);
      expect(quote).not.toBeNull();
      expect(quote?.quoteNumber).toBe(created.quote.quoteNumber);
      expect(quote?.status).toBe('issued');
      expect(quote?.currency).toBe('INR');
      expect(quote?.subtotal).toBe(15000);
      expect(quote?.taxClassification).toBe('intra_state');
      expect(quote?.cgstTotal).toBe(1350); // 9% of 15000
      expect(quote?.sgstTotal).toBe(1350); // 9% of 15000
      expect(quote?.grandTotal).toBe(17700); // 15000 + 2700
      expect(quote?.lines).toHaveLength(1);
      expect(quote?.lines[0].productName).toBe('Growth Assessment Tier');
      expect(quote?.companyName).toBe('Acme Corporation');
      expect(quote?.customerName).toBe('Quote Customer');

      // Verify public CustomerQuoteDto excludes internal IDs and sensitive contact email
      expect((quote as any)?.leadId).toBeUndefined();
      expect((quote as any)?.orgId).toBeUndefined();
      expect((quote as any)?.promoCodeId).toBeUndefined();
      expect((quote as any)?.customerEmail).toBeUndefined();
    });

    it('returns 404 for invalid, unknown, or malformed tokens (safe 404 behavior)', async () => {
      if (!isDbAvailable) return;

      const nonExistentToken = crypto.randomBytes(32).toString('hex');
      const quote = await quotesService.getQuoteByToken(nonExistentToken);
      expect(quote).toBeNull();

      // Controller should throw RFC 7807 problem with 404 status
      await expect(
        customerController.getQuoteByToken(nonExistentToken, {} as any),
      ).rejects.toMatchObject({
        status: 404,
        response: expect.objectContaining({
          code: 'QUOTE_NOT_FOUND',
        }),
      });

      // Malformed / empty token
      await expect(
        customerController.getQuoteByToken('', {} as any),
      ).rejects.toMatchObject({
        status: 404,
      });
    });

    it('returns expired status when viewing a quote past its expiration date', async () => {
      if (!isDbAvailable) return;

      const created = await createTestQuote();

      // Backdate the quote in the database to simulate expiration
      await platformPool.query(
        `UPDATE app.quotes
         SET expires_at = clock_timestamp() - interval '2 days',
             status = 'issued'
         WHERE id = $1`,
        [created.quote.id],
      );

      const quote = await quotesService.getQuoteByToken(created.publicToken);
      expect(quote).not.toBeNull();
      expect(quote?.status).toBe('expired');
    });
  });

  describe('2. One-Click Quote Approval (POST /quotes/:token/accept)', () => {
    it('successfully accepts an issued quote and sets acceptance evidence in the database', async () => {
      if (!isDbAvailable) return;

      const created = await createTestQuote();
      const clientIp = '203.0.113.42';
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0';

      const response = await quotesService.acceptQuote({
        token: created.publicToken,
        acceptedByName: 'Jane Doe, VP Engineering',
        confirmationAcknowledged: true,
        clientIp,
        userAgent,
        requestId: 'req-test-accept-001',
      });

      expect(response.success).toBe(true);
      expect(response.alreadyAccepted).toBe(false);
      expect(response.quote.status).toBe('accepted');
      expect(response.quote.acceptedAt).toBeDefined();
      expect(response.quote.acceptedByName).toBe('Jane Doe, VP Engineering');

      // Verify direct database state
      const dbRes = await platformPool.query(
        `SELECT status, accepted_at, accepted_by_ip, accepted_by_user_agent, accepted_by_name
         FROM app.quotes
         WHERE id = $1`,
        [created.quote.id],
      );

      const row = dbRes.rows[0];
      expect(row.status).toBe('accepted');
      expect(row.accepted_at).not.toBeNull();
      expect(row.accepted_by_ip).toBe(clientIp);
      expect(row.accepted_by_user_agent).toBe(userAgent);
      expect(row.accepted_by_name).toBe('Jane Doe, VP Engineering');
    });

    it('records an append-only audit event in audit.events within the same transaction', async () => {
      if (!isDbAvailable) return;

      const created = await createTestQuote();

      await quotesService.acceptQuote({
        token: created.publicToken,
        acceptedByName: 'Alice Smith, CTO',
        confirmationAcknowledged: true,
        clientIp: '198.51.100.25',
        userAgent: 'Edge/129.0.0.0',
        requestId: 'req-audit-verify-002',
      });

      // Verify audit event written to audit.events
      const auditRes = await platformPool.query(
        `SELECT action, entity, entity_id, before, after, ip, user_agent, request_id
         FROM audit.events
         WHERE entity = 'quote' AND entity_id = $1 AND action = 'quote.accepted'`,
        [created.quote.id],
      );

      expect(auditRes.rows).toHaveLength(1);
      const audit = auditRes.rows[0];
      expect(audit.action).toBe('quote.accepted');
      expect(audit.entity_id).toBe(created.quote.id);
      expect(audit.ip).toBe('198.51.100.25');
      expect(audit.user_agent).toBe('Edge/129.0.0.0');
      expect(audit.request_id).toBe('req-audit-verify-002');
      expect(audit.before).toMatchObject({ status: 'issued' });
      expect(audit.after).toMatchObject({
        status: 'accepted',
        quoteNumber: created.quote.quoteNumber,
        grandTotal: 17700,
        currency: 'INR',
        acceptedByName: 'Alice Smith, CTO',
      });
    });

    it('guarantees financial snapshot immutability post-acceptance', async () => {
      if (!isDbAvailable) return;

      const created = await createTestQuote();

      const acceptRes = await quotesService.acceptQuote({
        token: created.publicToken,
        acceptedByName: 'Bob Builder',
        confirmationAcknowledged: true,
      });

      // Verify financial fields are identical to initial issuance
      expect(acceptRes.quote.subtotal).toBe(created.quote.subtotal);
      expect(acceptRes.quote.taxableAmount).toBe(created.quote.taxableAmount);
      expect(acceptRes.quote.cgstTotal).toBe(created.quote.cgstTotal);
      expect(acceptRes.quote.sgstTotal).toBe(created.quote.sgstTotal);
      expect(acceptRes.quote.grandTotal).toBe(created.quote.grandTotal);

      // Verify DB immutability trigger prevents any manual modification of financial fields
      await expect(
        platformPool.query(
          `UPDATE app.quotes SET grand_total = 99999.00 WHERE id = $1`,
          [created.quote.id],
        ),
      ).rejects.toThrow(/Issued commercial quotations are immutable/);

      // Verify line items are also blocked from alteration
      await expect(
        platformPool.query(
          `UPDATE app.quote_lines SET line_total = 99999.00 WHERE quote_id = $1`,
          [created.quote.id],
        ),
      ).rejects.toThrow(/Line items for issued commercial quotes cannot be inserted, updated or deleted/);
    });

    it('is strictly idempotent: second acceptance returns alreadyAccepted without duplicate audit events', async () => {
      if (!isDbAvailable) return;

      const created = await createTestQuote();

      // First acceptance
      const firstRes = await quotesService.acceptQuote({
        token: created.publicToken,
        acceptedByName: 'First Approver',
        confirmationAcknowledged: true,
      });
      expect(firstRes.success).toBe(true);
      expect(firstRes.alreadyAccepted).toBe(false);

      const firstAcceptedAt = firstRes.quote.acceptedAt;

      // Second acceptance with same token
      const secondRes = await quotesService.acceptQuote({
        token: created.publicToken,
        acceptedByName: 'Second Approver Attempt',
        confirmationAcknowledged: true,
      });

      expect(secondRes.success).toBe(true);
      expect(secondRes.alreadyAccepted).toBe(true);
      expect(secondRes.quote.status).toBe('accepted');
      expect(secondRes.quote.acceptedAt).toBe(firstAcceptedAt); // Unchanged

      // Verify only ONE audit event exists for this quote acceptance
      const auditCount = await platformPool.query(
        `SELECT count(*)::int AS cnt
         FROM audit.events
         WHERE entity = 'quote' AND entity_id = $1 AND action = 'quote.accepted'`,
        [created.quote.id],
      );
      expect(auditCount.rows[0].cnt).toBe(1);
    });

    it('guarantees concurrency safety: concurrent acceptance calls resolve cleanly via row-level locks', async () => {
      if (!isDbAvailable) return;

      const created = await createTestQuote();

      // Run two simultaneous acceptance requests concurrently on independent pool connections
      const [resA, resB] = await Promise.all([
        quotesService.acceptQuote({
          token: created.publicToken,
          acceptedByName: 'Signer A',
          confirmationAcknowledged: true,
          clientIp: '10.0.0.1',
        }),
        quotesService.acceptQuote({
          token: created.publicToken,
          acceptedByName: 'Signer B',
          confirmationAcknowledged: true,
          clientIp: '10.0.0.2',
        }),
      ]);

      expect(resA.success).toBe(true);
      expect(resB.success).toBe(true);

      // Exactly one was the first acceptance, the other recognized alreadyAccepted
      const alreadyAcceptedFlags = [resA.alreadyAccepted, resB.alreadyAccepted];
      expect(alreadyAcceptedFlags).toContain(false);
      expect(alreadyAcceptedFlags).toContain(true);

      // Verify exactly one audit event created
      const auditCount = await platformPool.query(
        `SELECT count(*)::int AS cnt
         FROM audit.events
         WHERE entity = 'quote' AND entity_id = $1 AND action = 'quote.accepted'`,
        [created.quote.id],
      );
      expect(auditCount.rows[0].cnt).toBe(1);
    });

    it('rejects acceptance of expired quotes with RFC 7807 422 error', async () => {
      if (!isDbAvailable) return;

      const created = await createTestQuote();

      // Backdate the quote in the database to simulate expiration
      await platformPool.query(
        `UPDATE app.quotes
         SET expires_at = clock_timestamp() - interval '1 day',
             status = 'issued'
         WHERE id = $1`,
        [created.quote.id],
      );

      await expect(
        quotesService.acceptQuote({
          token: created.publicToken,
          acceptedByName: 'Late Approver',
          confirmationAcknowledged: true,
        }),
      ).rejects.toMatchObject({
        status: 422,
        response: expect.objectContaining({
          code: 'QUOTE_EXPIRED',
        }),
      });

      // Verify status in DB was updated to expired
      const checkRes = await platformPool.query(
        `SELECT status FROM app.quotes WHERE id = $1`,
        [created.quote.id],
      );
      expect(checkRes.rows[0].status).toBe('expired');
    });

    it('rejects acceptance of declined or superseded quotes with 422', async () => {
      if (!isDbAvailable) return;

      const createdRejected = await createTestQuote();
      await platformPool.query(
        `UPDATE app.quotes SET status = 'rejected' WHERE id = $1`,
        [createdRejected.quote.id],
      );

      await expect(
        quotesService.acceptQuote({
          token: createdRejected.publicToken,
          confirmationAcknowledged: true,
        }),
      ).rejects.toMatchObject({
        status: 422,
        response: expect.objectContaining({
          code: 'QUOTE_REJECTED',
        }),
      });

      const createdSuperseded = await createTestQuote();
      await platformPool.query(
        `UPDATE app.quotes SET status = 'superseded' WHERE id = $1`,
        [createdSuperseded.quote.id],
      );

      await expect(
        quotesService.acceptQuote({
          token: createdSuperseded.publicToken,
          confirmationAcknowledged: true,
        }),
      ).rejects.toMatchObject({
        status: 422,
        response: expect.objectContaining({
          code: 'QUOTE_SUPERSEDED',
        }),
      });
    });

    it('enforces validation on acceptance request payload via CustomerQuotesController', async () => {
      if (!isDbAvailable) return;

      const created = await createTestQuote();

      // Missing confirmationAcknowledged
      await expect(
        customerController.acceptQuote(created.publicToken, {}, {} as any),
      ).rejects.toMatchObject({
        status: 422,
        response: expect.objectContaining({
          code: 'VALIDATION_FAILED',
        }),
      });

      // Valid payload via controller
      const mockReq: any = {
        headers: {
          'x-forwarded-for': '12.34.56.78',
          'user-agent': 'Vitest/ControllerTest',
          'x-request-id': 'req-ctrl-001',
        },
        ip: '12.34.56.78',
      };

      const result = await customerController.acceptQuote(
        created.publicToken,
        {
          acceptedByName: 'Controller Tester',
          confirmationAcknowledged: true,
        },
        mockReq,
      );

      expect(result.success).toBe(true);
      expect(result.quote.status).toBe('accepted');
      expect(result.quote.acceptedByName).toBe('Controller Tester');

      // Verify public DTO returned by acceptance also excludes internal IDs and email
      expect((result.quote as any).leadId).toBeUndefined();
      expect((result.quote as any).orgId).toBeUndefined();
      expect((result.quote as any).promoCodeId).toBeUndefined();
      expect((result.quote as any).customerEmail).toBeUndefined();

      // Verify DB records accepted_by_ip as null (untrusted/unverified proxy boundary)
      const dbCheck = await platformPool.query(
        `SELECT accepted_by_ip, accepted_by_name, accepted_by_user_agent FROM app.quotes WHERE id = $1`,
        [created.quote.id],
      );
      expect(dbCheck.rows[0].accepted_by_ip).toBeNull();
      expect(dbCheck.rows[0].accepted_by_name).toBe('Controller Tester');
      expect(dbCheck.rows[0].accepted_by_user_agent).toBe('Vitest/ControllerTest');
    });
  });
});
