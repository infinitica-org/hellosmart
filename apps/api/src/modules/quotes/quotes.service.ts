import crypto from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import type {
  AcceptQuoteResponseDto,
  CreateQuoteDto,
  CreateQuoteResponseDto,
  CustomerQuoteDto,
  QuoteDto,
  QuoteLineDto,
} from '@hs/contracts';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { PG_PLATFORM_POOL } from '../database/database.tokens.js';
import { appendAuditEvent } from '../audit/audit-writer.js';
import { problem } from '../../common/errors/app-http.exception.js';
import { GstCalculatorService } from './gst-calculator.service.js';
import { PricingCatalogService } from './pricing-catalog.service.js';
import { PromoCodesService } from './promo-codes.service.js';
import { REDIS_CLIENT, type HelloRedisClient } from '../redis/redis.tokens.js';
import { EMAIL_SENDER_PORT, type EmailSenderPort } from '../adapters/adapters.tokens.js';
import {
  encryptQuoteToken,
  decryptQuoteToken,
  timingSafeTokenHashEqual,
} from './quote-token.util.js';

function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    @Inject(PG_PLATFORM_POOL) private readonly pool: Pool,
    @Optional() @Inject(APP_CONFIG) private readonly config: Config | undefined,
    private readonly catalogService: PricingCatalogService,
    private readonly promoService: PromoCodesService,
    private readonly gstService: GstCalculatorService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: HelloRedisClient,
    @Optional() @Inject(EMAIL_SENDER_PORT) private readonly emailSender?: EmailSenderPort,
  ) {}

  /**
   * Helper to execute queries on the platform pool with app.is_platform = 'true'
   * so Row Level Security (RLS) policies permit platform operations across leads and quotes.
   */
  private async queryWithPlatform<T extends QueryResultRow = any>(
    sql: string,
    params?: any[],
  ): Promise<QueryResult<T>> {
    const client = await this.pool.connect();
    try {
      await client.query("SELECT set_config('app.is_platform', 'true', false)");
      return await client.query<T>(sql, params);
    } finally {
      client.release();
    }
  }

  /**
   * Generates a commercial quote with itemized lines, promo discount, 18% GST calculation,
   * and cryptographically secure public access token.
   */
  async createQuote(params: {
    dto: CreateQuoteDto;
    userId?: string | null | undefined;
    userRole?: string | null | undefined;
    ip?: string | undefined;
    userAgent?: string | undefined;
    requestId?: string | undefined;
  }): Promise<CreateQuoteResponseDto> {
    const { dto, userId, userRole, ip, userAgent, requestId } = params;

    // 1. Verify customer reference
    if (dto.leadId) {
      const leadCheck = await this.queryWithPlatform(
        `SELECT id, stage FROM app.leads WHERE id = $1 AND deleted_at IS NULL`,
        [dto.leadId],
      );
      if (leadCheck.rows.length === 0) {
        throw problem({
          title: 'Not Found',
          status: 404,
          detail: `Sales lead '${dto.leadId}' does not exist or has been deleted`,
          code: 'LEAD_NOT_FOUND',
        });
      }
    } else if (dto.orgId) {
      const orgCheck = await this.queryWithPlatform(
        `SELECT id, status FROM app.organizations WHERE id = $1`,
        [dto.orgId],
      );
      if (orgCheck.rows.length === 0) {
        throw problem({
          title: 'Not Found',
          status: 404,
          detail: `Organization '${dto.orgId}' does not exist`,
          code: 'ORGANIZATION_NOT_FOUND',
        });
      }
    } else {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Either leadId or orgId must be provided',
        code: 'CUSTOMER_REFERENCE_REQUIRED',
      });
    }

    // 2. Fetch and validate catalog products server-side
    const resolvedItems: Array<{
      catalogProduct: any;
      quantity: number;
      lineSubtotal: number;
    }> = [];

    for (const item of dto.items) {
      const product = await this.catalogService.getCatalogItemById(item.catalogProductId);
      if (!product) {
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: `Catalog product '${item.catalogProductId}' not found`,
          code: 'PRODUCT_NOT_FOUND',
        });
      }

      if (!product.isActive) {
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: `Catalog product '${product.name}' (${product.code}) is inactive and cannot be quoted`,
          code: 'PRODUCT_INACTIVE',
        });
      }

      if (product.currency !== dto.currency) {
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: `Product '${product.name}' is priced in ${product.currency}, but quote is in ${dto.currency}`,
          code: 'CURRENCY_MISMATCH',
        });
      }

      const lineSubtotal = roundToTwo(product.unitPrice * item.quantity);
      resolvedItems.push({
        catalogProduct: product,
        quantity: item.quantity,
        lineSubtotal,
      });
    }

    // 3. Evaluate promo code if supplied
    let promoResult: any = null;
    if (dto.promoCode && dto.promoCode.trim().length > 0) {
      promoResult = await this.promoService.evaluatePromo({
        code: dto.promoCode,
        currency: dto.currency,
        items: resolvedItems.map((ri) => ({
          catalogProductId: ri.catalogProduct.id,
          category: ri.catalogProduct.category,
          billingType: ri.catalogProduct.billingType,
          lineSubtotal: ri.lineSubtotal,
        })),
      });
    }

    // 4. Calculate GST & Tax distribution
    const taxInputLines = resolvedItems.map((ri) => {
      const discountAmount = promoResult?.lineDiscounts?.get(ri.catalogProduct.id) || 0;
      return {
        lineSubtotal: ri.lineSubtotal,
        discountAmount,
      };
    });

    const taxResult = this.gstService.calculateTax({
      currency: dto.currency,
      customerJurisdiction: dto.customerJurisdiction,
      sellerJurisdiction: dto.sellerJurisdiction,
      lines: taxInputLines,
    });

    const subtotal = roundToTwo(resolvedItems.reduce((acc, ri) => acc + ri.lineSubtotal, 0));
    const discountTotal = promoResult ? promoResult.totalDiscount : 0;
    const taxableAmount = roundToTwo(subtotal - discountTotal);
    const cgstTotal = taxResult.cgstTotal;
    const sgstTotal = taxResult.sgstTotal;
    const igstTotal = taxResult.igstTotal;
    const taxTotal = taxResult.taxTotal;
    const grandTotal = roundToTwo(taxableAmount + taxTotal);

    // 5. Generate secure token & quote number
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const secretKey =
      this.config?.SESSION_SECRET ||
      process.env.SESSION_SECRET ||
      'dev-fallback-secret-key-at-least-32-chars';
    const encryptedToken = encryptQuoteToken(rawToken, secretKey);

    const expiresInDays = dto.expiresInDays ?? 14;
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

    // 6. Execute Transaction
    const client: PoolClient = await this.pool.connect();
    let quoteId: string;
    let quoteNumber: string;

    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.is_platform', 'true', true)");

      // Generate atomic monotonic quote number: Q-YYYYMM-XXXX
      const monthPrefix = `Q-${issuedAt.getFullYear()}${String(issuedAt.getMonth() + 1).padStart(2, '0')}-`;
      // Acquire advisory lock on quote number generation to serialize counter
      await client.query(`SELECT pg_advisory_xact_lock(4, 9999)`);
      const countRes = await client.query(
        `SELECT count(*) FROM app.quotes WHERE quote_number LIKE $1`,
        [monthPrefix + '%'],
      );
      const nextSeq = parseInt(countRes.rows[0].count, 10) + 1;
      quoteNumber = `${monthPrefix}${String(nextSeq).padStart(4, '0')}`;

      // Verify created_by user exists if passed
      let validUserId: string | null = null;
      if (userId) {
        const uRes = await client.query(`SELECT id FROM app.users WHERE id = $1`, [userId]);
        if (uRes.rows.length > 0) {
          validUserId = userId;
        }
      }

      // Insert Quote with status 'draft'
      const quoteRes = await client.query(
        `INSERT INTO app.quotes (
           quote_number, lead_id, org_id, currency, status,
           subtotal, discount_total, taxable_amount, cgst_total, sgst_total, igst_total,
           tax_total, grand_total, tax_classification, seller_jurisdiction, customer_jurisdiction,
           promo_code_id, notes, public_token_hash, encrypted_token, issued_at, expires_at, created_by
         ) VALUES (
           $1, $2, $3, $4, 'draft',
           $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14::jsonb, $15::jsonb,
           $16, $17, $18, $19, $20, $21, $22
         ) RETURNING id`,
        [
          quoteNumber,
          dto.leadId || null,
          dto.orgId || null,
          dto.currency,
          subtotal,
          discountTotal,
          taxableAmount,
          cgstTotal,
          sgstTotal,
          igstTotal,
          taxTotal,
          grandTotal,
          taxResult.taxClassification,
          JSON.stringify(taxResult.sellerJurisdiction),
          JSON.stringify(taxResult.customerJurisdiction),
          promoResult ? promoResult.promoCodeId : null,
          dto.notes || null,
          tokenHash,
          encryptedToken,
          issuedAt.toISOString(),
          expiresAt.toISOString(),
          validUserId,
        ],
      );
      quoteId = quoteRes.rows[0].id;

      // Insert Quote Lines
      for (let i = 0; i < resolvedItems.length; i++) {
        const ri = resolvedItems[i];
        const tl = taxResult.lines[i];
        if (!ri || !tl) continue;
        const discountAmount = promoResult?.lineDiscounts?.get(ri.catalogProduct.id) || 0;

        await client.query(
          `INSERT INTO app.quote_lines (
             quote_id, catalog_product_id, product_code, product_name, description,
             category, billing_type, billing_interval, quantity, unit_price,
             line_subtotal, discount_amount, taxable_amount, tax_type, tax_rate,
             tax_amount, line_total
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15,
             $16, $17
           )`,
          [
            quoteId,
            ri.catalogProduct.id,
            ri.catalogProduct.code,
            ri.catalogProduct.name,
            ri.catalogProduct.description || null,
            ri.catalogProduct.category,
            ri.catalogProduct.billingType,
            ri.catalogProduct.billingInterval || null,
            ri.quantity,
            ri.catalogProduct.unitPrice,
            ri.lineSubtotal,
            discountAmount,
            tl.taxableAmount,
            tl.taxType,
            tl.taxRate,
            tl.taxAmount,
            tl.lineTotal,
          ],
        );
      }

      // Seal quote: transition status from 'draft' to 'issued'
      await client.query(
        `UPDATE app.quotes
         SET status = 'issued', updated_at = clock_timestamp()
         WHERE id = $1`,
        [quoteId],
      );

      // If promo was applied, consume redemption atomically
      if (promoResult) {
        await this.promoService.redeemPromoAtomic({
          client,
          promoCodeId: promoResult.promoCodeId,
          quoteId,
          discountApplied: discountTotal,
        });
      }

      // If quote is linked to a sales lead, update lead stage to 'quoted'
      if (dto.leadId) {
        await client.query(
          `UPDATE app.leads
           SET stage = 'quoted', updated_at = clock_timestamp()
           WHERE id = $1`,
          [dto.leadId],
        );
      }

      // Audit Log
      await appendAuditEvent(client, {
        actorId: userId || null,
        actorRole: userRole || 'platform_admin',
        orgId: dto.orgId || null,
        action: 'quote.issued',
        entity: 'quote',
        entityId: quoteId,
        after: {
          quoteNumber,
          currency: dto.currency,
          subtotal,
          discountTotal,
          taxTotal,
          grandTotal,
          leadId: dto.leadId || null,
          orgId: dto.orgId || null,
          expiresAt: expiresAt.toISOString(),
        },
        ip,
        userAgent,
        requestId,
      });

      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      this.logger.error(`Failed to create quote: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }

    // Retrieve complete quote representation
    const createdQuote = await this.getQuoteById(quoteId);
    if (!createdQuote) {
      throw new Error(`Failed to retrieve newly created quote ${quoteId}`);
    }

    // Cache raw public token in Redis for email workflow and resending
    if (this.redis?.isOpen) {
      await this.redis.set(`quote_token:${quoteId}`, rawToken, {
        EX: expiresInDays * 24 * 60 * 60,
      }).catch((e: any) => this.logger.warn(`Failed to cache quote token in redis: ${e.message}`));
    }

    return {
      quote: createdQuote,
      publicToken: rawToken,
      publicUrl: `/quotes/${rawToken}`,
    };
  }

  async getQuoteById(id: string, orgId?: string | null | undefined): Promise<QuoteDto | null> {
    const params: any[] = [id];
    let sql = `SELECT * FROM app.quotes WHERE id = $1`;
    if (orgId) {
      params.push(orgId);
      sql += ` AND org_id = $2`;
    }
    const quoteRes = await this.queryWithPlatform(sql, params);
    if (quoteRes.rows.length === 0) return null;

    const linesRes = await this.queryWithPlatform(
      `SELECT * FROM app.quote_lines WHERE quote_id = $1 ORDER BY created_at ASC`,
      [id],
    );

    const customerDetails = await this.resolveCustomerDetails(this.pool, quoteRes.rows[0]);
    return this.mapRowToQuote(quoteRes.rows[0], linesRes.rows, customerDetails);
  }

  async getQuoteByToken(token: string): Promise<CustomerQuoteDto | null> {
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return null;
    }
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
    const quoteRes = await this.queryWithPlatform(
      `SELECT * FROM app.quotes WHERE public_token_hash = $1`,
      [tokenHash],
    );
    if (quoteRes.rows.length === 0) return null;

    const quoteRow = quoteRes.rows[0];

    // If past expiration and still in 'issued' status, transition to 'expired'
    const isExpired = new Date(quoteRow.expires_at).getTime() < Date.now();
    if (isExpired && quoteRow.status === 'issued') {
      await this.queryWithPlatform(
        `UPDATE app.quotes SET status = 'expired', updated_at = clock_timestamp() WHERE id = $1`,
        [quoteRow.id],
      );
      quoteRow.status = 'expired';
    }

    const linesRes = await this.queryWithPlatform(
      `SELECT * FROM app.quote_lines WHERE quote_id = $1 ORDER BY created_at ASC`,
      [quoteRow.id],
    );

    const customerDetails = await this.resolveCustomerDetails(this.pool, quoteRow);
    return this.mapRowToCustomerQuote(quoteRow, linesRes.rows, customerDetails);
  }

  /**
   * One-Click Quote Acceptance (PHS-I128 / SP-010)
   * Atomically and idempotently accepts an issued quote.
   * Concurrency-safe via row-level locking (SELECT FOR UPDATE).
   * Appends an append-only audit event in the same transaction.
   */
  async acceptQuote(params: {
    token: string;
    acceptedByName?: string | undefined;
    confirmationAcknowledged: boolean;
    clientIp?: string | null | undefined;
    userAgent?: string | undefined;
    userId?: string | null | undefined;
    userRole?: string | null | undefined;
    requestId?: string | undefined;
  }): Promise<AcceptQuoteResponseDto> {
    if (!params.token || typeof params.token !== 'string' || params.token.trim().length === 0) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: 'Quotation not found or invalid access token',
        code: 'QUOTE_NOT_FOUND',
      });
    }

    const tokenHash = crypto.createHash('sha256').update(params.token.trim()).digest('hex');
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Row-level lock to prevent concurrency race conditions
      const quoteRes = await client.query(
        `SELECT * FROM app.quotes WHERE public_token_hash = $1 FOR UPDATE`,
        [tokenHash],
      );

      if (quoteRes.rows.length === 0) {
        await client.query('ROLLBACK');
        throw problem({
          title: 'Not Found',
          status: 404,
          detail: 'Quotation not found or invalid access token',
          code: 'QUOTE_NOT_FOUND',
        });
      }

      const quoteRow = quoteRes.rows[0];

      // Idempotency: Already accepted
      if (quoteRow.status === 'accepted') {
        await client.query('COMMIT');
        const linesRes = await this.queryWithPlatform(
          `SELECT * FROM app.quote_lines WHERE quote_id = $1 ORDER BY created_at ASC`,
          [quoteRow.id],
        );
        const customerDetails = await this.resolveCustomerDetails(this.pool, quoteRow);
        const mappedQuote = this.mapRowToCustomerQuote(quoteRow, linesRes.rows, customerDetails);
        return {
          success: true,
          quote: mappedQuote,
          alreadyAccepted: true,
          message: 'This quote was already approved.',
        };
      }

      // Expiry check
      const isExpired = new Date(quoteRow.expires_at).getTime() < Date.now();
      if (quoteRow.status === 'expired' || isExpired) {
        if (quoteRow.status === 'issued') {
          await client.query(
            `UPDATE app.quotes SET status = 'expired', updated_at = clock_timestamp() WHERE id = $1`,
            [quoteRow.id],
          );
        }
        await client.query('COMMIT');
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: `This quote expired on ${new Date(quoteRow.expires_at).toLocaleDateString()} and can no longer be accepted. Please contact HelloSmart to request an updated quotation.`,
          code: 'QUOTE_EXPIRED',
        });
      }

      // Terminal or non-acceptable statuses
      if (quoteRow.status === 'rejected') {
        await client.query('ROLLBACK');
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: 'This quote has been declined and cannot be accepted.',
          code: 'QUOTE_REJECTED',
        });
      }

      if (quoteRow.status === 'superseded') {
        await client.query('ROLLBACK');
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: 'This quote has been replaced by a newer quotation version.',
          code: 'QUOTE_SUPERSEDED',
        });
      }

      if (quoteRow.status !== 'issued') {
        await client.query('ROLLBACK');
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: `Quote in status '${quoteRow.status}' cannot be accepted.`,
          code: 'QUOTE_NOT_ACCEPTABLE',
        });
      }

      const acceptedByName = params.acceptedByName?.trim() || null;
      const clientIp = params.clientIp || null;
      const userAgent = params.userAgent || null;

      // Update quote row with acceptance metadata
      const updateRes = await client.query(
        `UPDATE app.quotes
         SET status = 'accepted',
             accepted_at = clock_timestamp(),
             accepted_by_ip = $2,
             accepted_by_user_agent = $3,
             accepted_by_name = $4,
             updated_at = clock_timestamp()
         WHERE id = $1
         RETURNING *`,
        [quoteRow.id, clientIp, userAgent, acceptedByName],
      );

      const updatedRow = updateRes.rows[0];

      // Append append-only audit event in the same transaction
      await appendAuditEvent(client, {
        actorId: params.userId || null,
        actorRole: params.userRole || 'customer',
        orgId: updatedRow.org_id || null,
        action: 'quote.accepted',
        entity: 'quote',
        entityId: updatedRow.id,
        before: {
          status: 'issued',
          quoteNumber: quoteRow.quote_number,
        },
        after: {
          status: 'accepted',
          quoteNumber: updatedRow.quote_number,
          grandTotal: parseFloat(updatedRow.grand_total),
          currency: updatedRow.currency,
          acceptedAt: updatedRow.accepted_at instanceof Date ? updatedRow.accepted_at.toISOString() : updatedRow.accepted_at,
          acceptedByName,
          ip: clientIp,
        },
        ip: clientIp,
        userAgent: userAgent,
        requestId: params.requestId || null,
      });

      await client.query('COMMIT');

      const linesRes = await this.queryWithPlatform(
        `SELECT * FROM app.quote_lines WHERE quote_id = $1 ORDER BY created_at ASC`,
        [updatedRow.id],
      );
      const customerDetails = await this.resolveCustomerDetails(this.pool, updatedRow);
      const mappedQuote = this.mapRowToCustomerQuote(updatedRow, linesRes.rows, customerDetails);

      return {
        success: true,
        quote: mappedQuote,
        alreadyAccepted: false,
        message: 'Quotation approved successfully.',
      };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {}
      throw err;
    } finally {
      client.release();
    }
  }

  async listQuotes(filter?: {
    leadId?: string | undefined;
    orgId?: string | undefined;
    status?: string | undefined;
  }): Promise<QuoteDto[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filter?.leadId) {
      conditions.push(`lead_id = $${idx++}`);
      values.push(filter.leadId);
    }
    if (filter?.orgId) {
      conditions.push(`org_id = $${idx++}`);
      values.push(filter.orgId);
    }
    if (filter?.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filter.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await this.queryWithPlatform(
      `SELECT * FROM app.quotes ${whereClause} ORDER BY created_at DESC`,
      values,
    );

    const quotes: QuoteDto[] = [];
    for (const row of res.rows) {
      const linesRes = await this.queryWithPlatform(
        `SELECT * FROM app.quote_lines WHERE quote_id = $1 ORDER BY created_at ASC`,
        [row.id],
      );
      const customerDetails = await this.resolveCustomerDetails(this.pool, row);
      quotes.push(this.mapRowToQuote(row, linesRes.rows, customerDetails));
    }

    return quotes;
  }

  /**
   * Dispatches a customer quote review link via email (customer email workflow).
   * Retrieves raw token from Redis cache or caller, resolves recipient email,
   * sends email via EmailSenderPort, and logs an append-only audit event.
   */
  async sendQuoteEmail(params: {
    quoteId: string;
    orgId?: string | null | undefined;
    publicToken?: string | undefined;
    recipientEmail?: string | undefined;
    actorId?: string | null | undefined;
    actorRole?: string | null | undefined;
    ip?: string | undefined;
    userAgent?: string | undefined;
    requestId?: string | undefined;
  }): Promise<{ success: boolean; quoteNumber: string; recipientEmail: string; sentAt: string }> {
    const quote = await this.getQuoteById(params.quoteId, params.orgId);
    if (!quote) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: `Quote '${params.quoteId}' not found`,
        code: 'QUOTE_NOT_FOUND',
      });
    }

    if (quote.status !== 'issued') {
      throw problem({
        title: 'Conflict',
        status: 409,
        detail: `Quotation is in '${quote.status}' status and cannot be sent`,
        code: 'INVALID_QUOTE_STATUS',
      });
    }

    if (new Date(quote.expiresAt).getTime() <= Date.now()) {
      throw problem({
        title: 'Gone',
        status: 410,
        detail: 'Quotation has expired and cannot be sent',
        code: 'QUOTE_EXPIRED',
      });
    }

    const secretKey =
      this.config?.SESSION_SECRET ||
      process.env.SESSION_SECRET ||
      'dev-fallback-secret-key-at-least-32-chars';

    let resolvedToken: string | null = null;

    // 1. Resolve authoritative token from encrypted_token in DB
    const encRes = await this.queryWithPlatform(
      `SELECT encrypted_token, public_token_hash FROM app.quotes WHERE id = $1`,
      [quote.id],
    );
    const storedHash: string = encRes.rows[0]?.public_token_hash;
    const encToken: string | undefined = encRes.rows[0]?.encrypted_token;

    if (encToken) {
      const decrypted = decryptQuoteToken(encToken, secretKey);
      if (decrypted && timingSafeTokenHashEqual(decrypted, storedHash)) {
        resolvedToken = decrypted;
      }
    }

    // 2. Fall back to Redis cache for legacy quotes created prior to encrypted_token column
    if (!resolvedToken && this.redis?.isOpen) {
      const cached = await this.redis.get(`quote_token:${quote.id}`).catch(() => null);
      if (cached && timingSafeTokenHashEqual(cached, storedHash)) {
        resolvedToken = cached;
      }
    }

    // 3. If caller supplied publicToken, validate against stored hash in constant time
    if (params.publicToken) {
      if (!timingSafeTokenHashEqual(params.publicToken, storedHash)) {
        throw problem({
          title: 'Unprocessable Entity',
          status: 422,
          detail: 'Supplied public token does not match quotation',
          code: 'QUOTE_TOKEN_MISMATCH',
        });
      }
      if (!resolvedToken) {
        resolvedToken = params.publicToken;
      }
    }

    if (!resolvedToken) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Quote access token is not available for sending. Please regenerate the quote.',
        code: 'QUOTE_TOKEN_UNAVAILABLE',
      });
    }

    let recipientEmail = params.recipientEmail || quote.customerEmail || '';
    let customerName = quote.customerName || 'Valued Customer';

    if (!recipientEmail && quote.leadId) {
      const leadRes = await this.queryWithPlatform(
        `SELECT email, name FROM app.leads WHERE id = $1 AND deleted_at IS NULL`,
        [quote.leadId],
      );
      if (leadRes.rows[0]) {
        recipientEmail = leadRes.rows[0].email;
        customerName = leadRes.rows[0].name || customerName;
      }
    } else if (!recipientEmail && quote.orgId) {
      const orgRes = await this.queryWithPlatform(
        `SELECT u.email, u.name, o.name as org_name
         FROM app.organizations o
         LEFT JOIN app.users u ON u.org_id = o.id AND u.role = 'company_admin'
         WHERE o.id = $1
         LIMIT 1`,
        [quote.orgId],
      );
      if (orgRes.rows[0]) {
        recipientEmail = orgRes.rows[0].email;
        customerName = orgRes.rows[0].name || orgRes.rows[0].org_name || customerName;
      }
    }

    if (!recipientEmail) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Recipient customer email not found for this quote.',
        code: 'CUSTOMER_EMAIL_NOT_FOUND',
      });
    }

    if (!this.emailSender) {
      throw problem({
        title: 'Service Unavailable',
        status: 503,
        detail: 'Email delivery service is not configured or available',
        code: 'EMAIL_SERVICE_UNAVAILABLE',
      });
    }

    // Canonical origin verification & HTTPS enforcement
    const appBaseUrl = (this.config?.APP_BASE_URL || process.env.APP_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    const urlObj = new URL(appBaseUrl);
    if (process.env.NODE_ENV === 'production' && urlObj.protocol !== 'https:') {
      throw problem({
        title: 'Internal Server Error',
        status: 500,
        detail: 'Production email links require a canonical https:// APP_BASE_URL',
        code: 'INSECURE_APP_ORIGIN',
      });
    }

    const absoluteReviewUrl = `${appBaseUrl}/quotes/${resolvedToken}`;
    const sentAt = new Date().toISOString();

    let sendResult: { providerId: string };
    try {
      sendResult = await this.emailSender.send({
        to: recipientEmail,
        template: 'quote_review',
        vars: {
          quoteNumber: quote.quoteNumber,
          customerName,
          grandTotal: `${quote.currency} ${quote.grandTotal.toFixed(2)}`,
          publicUrl: absoluteReviewUrl,
        },
        ...(quote.orgId ? { orgId: quote.orgId } : {}),
      });
    } catch (err: any) {
      this.logger.error(`Email delivery provider rejected message: ${err.message}`, err.stack);
      throw problem({
        title: 'Bad Gateway',
        status: 502,
        detail: `Email delivery provider rejected message: ${err.message}`,
        code: 'EMAIL_DELIVERY_FAILED',
      });
    }

    // Forward to Mailpit for local and development email preview (http://localhost:8025)
    try {
      const mailpitBase =
        (this.config as any)?.MAILPIT_URL ||
        process.env.MAILPIT_URL ||
        'http://127.0.0.1:8025';

      await fetch(`${mailpitBase.replace(/\/$/, '')}/api/v1/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          From: { Email: 'no-reply@hellosmart.ai', Name: 'HelloSmart Commercial' },
          To: [{ Email: recipientEmail, Name: customerName }],
          Subject: `Commercial Quotation ${quote.quoteNumber} from HelloSmart.ai`,
          HTML: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e5e5; border-radius: 12px; background: #ffffff;">
              <h2 style="color: #111; margin-top: 0;">HelloSmart.ai — Commercial Quotation</h2>
              <p>Dear ${customerName},</p>
              <p>Your commercial quotation <strong>${quote.quoteNumber}</strong> has been generated and is ready for your review.</p>
              <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #f3f4f6;">
                <p style="margin: 4px 0; font-size: 14px;"><strong>Quotation Number:</strong> <span style="font-family: monospace;">${quote.quoteNumber}</span></p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Grand Total (incl. GST):</strong> <span style="font-family: monospace; color: #2563eb; font-weight: bold;">${quote.currency} ${quote.grandTotal.toFixed(2)}</span></p>
                <p style="margin: 4px 0; font-size: 14px;"><strong>Statutory Tax Classification:</strong> ${quote.taxClassification}</p>
              </div>
              <p>Please click the button below to review item details, tax calculations, and approve the quotation:</p>
              <div style="margin: 28px 0;">
                <a href="${absoluteReviewUrl}" style="background-color: #111827; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">
                  Review &amp; Approve Quotation &rarr;
                </a>
              </div>
              <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Direct Link: <a href="${absoluteReviewUrl}">${absoluteReviewUrl}</a></p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
              <p style="color: #9ca3af; font-size: 11px; margin-bottom: 0;">HelloSmart.ai &bull; Hire by Doing &bull; Statutory 18% GST Dual-Snapshot Engine</p>
            </div>
          `,
          Text: `Dear ${customerName},\n\nYour commercial quotation ${quote.quoteNumber} is ready for review.\nGrand Total: ${quote.currency} ${quote.grandTotal.toFixed(2)}\n\nReview link: ${absoluteReviewUrl}\n`,
        }),
        signal: AbortSignal.timeout(5000),
      }).catch((e: any) => this.logger.warn(`Mailpit send warning: ${e.message}`));
    } catch (e: any) {
      this.logger.warn(`Failed to dispatch to Mailpit: ${e.message}`);
    }

    // Append append-only audit event (CRITICAL: NEVER record raw token or publicUrl!)
    const client = await this.pool.connect();
    try {
      await appendAuditEvent(client, {
        actorId: params.actorId || null,
        actorRole: params.actorRole || 'platform_admin',
        orgId: quote.orgId || null,
        action: 'quote.sent',
        entity: 'quote',
        entityId: quote.id,
        after: {
          quoteNumber: quote.quoteNumber,
          recipientEmail,
          sentAt,
          deliveryStatus: 'accepted_by_provider',
          providerMessageId: sendResult.providerId,
        },
        ip: params.ip,
        userAgent: params.userAgent,
        requestId: params.requestId,
      });
    } finally {
      client.release();
    }

    return {
      success: true,
      quoteNumber: quote.quoteNumber,
      recipientEmail,
      sentAt,
    };
  }

  /**
   * Lists Cal.com sales leads with active booking information.
   * Supports filtering by stage, search query, or tenant organization.
   */
  async listLeads(filter?: {
    stage?: string | undefined;
    search?: string | undefined;
    orgId?: string | undefined;
  }): Promise<any[]> {
    const conditions: string[] = ['l.deleted_at IS NULL'];
    const values: any[] = [];
    let idx = 1;

    if (filter?.orgId) {
      conditions.push(`l.org_id = $${idx++}`);
      values.push(filter.orgId);
    }
    if (filter?.stage) {
      conditions.push(`l.stage = $${idx++}`);
      values.push(filter.stage);
    }
    if (filter?.search) {
      conditions.push(`(l.email ILIKE $${idx} OR l.name ILIKE $${idx} OR l.company ILIKE $${idx})`);
      values.push(`%${filter.search}%`);
      idx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const sql = `
      SELECT
        l.id,
        l.org_id,
        l.email,
        l.name,
        l.company,
        l.calcom_booking_id,
        l.utm,
        l.stage,
        l.owner_user_id,
        l.active_booking_id,
        l.created_at,
        l.updated_at,
        b.title AS active_booking_title,
        b.start_time AS active_booking_start,
        b.end_time AS active_booking_end,
        b.status AS active_booking_status,
        b.meeting_url AS active_booking_meeting_url
      FROM app.leads l
      LEFT JOIN app.lead_bookings b ON b.id = l.active_booking_id
      ${whereClause}
      ORDER BY l.created_at DESC
    `;

    const res = await this.queryWithPlatform(sql, values);
    return res.rows.map((row) => ({
      id: row.id,
      orgId: row.org_id,
      email: row.email,
      name: row.name,
      company: row.company,
      calcomBookingId: row.calcom_booking_id,
      utm: row.utm || {},
      stage: row.stage,
      ownerUserId: row.owner_user_id,
      activeBookingId: row.active_booking_id,
      activeBooking: row.active_booking_id
        ? {
            title: row.active_booking_title,
            startTime: row.active_booking_start,
            endTime: row.active_booking_end,
            status: row.active_booking_status,
            meetingUrl: row.active_booking_meeting_url,
          }
        : null,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    }));
  }

  /**
   * Retrieves single lead and its booking history.
   * If orgId is provided, strictly enforces tenant isolation in the SQL query.
   */
  async getLeadById(id: string, orgId?: string | null | undefined): Promise<any | null> {
    const conditions = ['id = $1', 'deleted_at IS NULL'];
    const values: any[] = [id];
    if (orgId) {
      conditions.push('org_id = $2');
      values.push(orgId);
    }
    const res = await this.queryWithPlatform(
      `SELECT * FROM app.leads WHERE ${conditions.join(' AND ')}`,
      values,
    );
    if (res.rows.length === 0) return null;
    const lead = res.rows[0];

    const bookingsRes = await this.queryWithPlatform(
      `SELECT * FROM app.lead_bookings WHERE lead_id = $1 ORDER BY created_at DESC`,
      [id],
    );

    return {
      id: lead.id,
      orgId: lead.org_id,
      email: lead.email,
      name: lead.name,
      company: lead.company,
      calcomBookingId: lead.calcom_booking_id,
      utm: lead.utm || {},
      stage: lead.stage,
      ownerUserId: lead.owner_user_id,
      activeBookingId: lead.active_booking_id,
      createdAt: lead.created_at instanceof Date ? lead.created_at.toISOString() : lead.created_at,
      updatedAt: lead.updated_at instanceof Date ? lead.updated_at.toISOString() : lead.updated_at,
      bookings: bookingsRes.rows.map((b) => ({
        id: b.id,
        uid: b.uid,
        status: b.status,
        title: b.title,
        startTime: b.start_time instanceof Date ? b.start_time.toISOString() : b.start_time,
        endTime: b.end_time instanceof Date ? b.end_time.toISOString() : b.end_time,
        location: b.location,
        meetingUrl: b.meeting_url,
        cancellationReason: b.cancellation_reason,
        createdAt: b.created_at instanceof Date ? b.created_at.toISOString() : b.created_at,
      })),
    };
  }

  private async resolveCustomerDetails(
    clientOrPool: Pool | PoolClient,
    qRow: any,
  ): Promise<{ name: string | null; email: string | null; company: string | null }> {
    if (qRow.lead_id) {
      try {
        const leadRes = await this.queryWithPlatform(
          `SELECT name, email, company FROM app.leads WHERE id = $1`,
          [qRow.lead_id],
        );
        if (leadRes.rows.length > 0) {
          const l = leadRes.rows[0];
          return {
            name: l.name ?? null,
            email: l.email ?? null,
            company: l.company ?? null,
          };
        }
      } catch (err) {
        this.logger.warn(`Failed to resolve lead customer details: ${err}`);
      }
    } else if (qRow.org_id) {
      try {
        const orgRes = await this.queryWithPlatform(
          `SELECT name FROM app.organizations WHERE id = $1`,
          [qRow.org_id],
        );
        if (orgRes.rows.length > 0) {
          return {
            name: null,
            email: null,
            company: orgRes.rows[0].name ?? null,
          };
        }
      } catch (err) {
        this.logger.warn(`Failed to resolve org customer details: ${err}`);
      }
    }
    return { name: null, email: null, company: null };
  }

  private mapRowToQuote(
    qRow: any,
    lRows: any[],
    customerDetails?: { name: string | null; email: string | null; company: string | null },
  ): QuoteDto {
    const lines: QuoteLineDto[] = lRows.map((lr) => ({
      id: lr.id,
      catalogProductId: lr.catalog_product_id,
      productCode: lr.product_code,
      productName: lr.product_name,
      description: lr.description,
      category: lr.category,
      billingType: lr.billing_type,
      billingInterval: lr.billing_interval,
      quantity: lr.quantity,
      unitPrice: parseFloat(lr.unit_price),
      lineSubtotal: parseFloat(lr.line_subtotal),
      discountAmount: parseFloat(lr.discount_amount),
      taxableAmount: parseFloat(lr.taxable_amount),
      taxType: lr.tax_type,
      taxRate: parseFloat(lr.tax_rate),
      taxAmount: parseFloat(lr.tax_amount),
      lineTotal: parseFloat(lr.line_total),
    }));

    return {
      id: qRow.id,
      quoteNumber: qRow.quote_number,
      leadId: qRow.lead_id,
      orgId: qRow.org_id,
      currency: qRow.currency,
      status: qRow.status,
      subtotal: parseFloat(qRow.subtotal),
      discountTotal: parseFloat(qRow.discount_total),
      taxableAmount: parseFloat(qRow.taxable_amount),
      cgstTotal: parseFloat(qRow.cgst_total),
      sgstTotal: parseFloat(qRow.sgst_total),
      igstTotal: parseFloat(qRow.igst_total),
      taxTotal: parseFloat(qRow.tax_total),
      grandTotal: parseFloat(qRow.grand_total),
      taxClassification: qRow.tax_classification,
      sellerJurisdiction: qRow.seller_jurisdiction,
      customerJurisdiction: qRow.customer_jurisdiction,
      promoCodeId: qRow.promo_code_id,
      notes: qRow.notes,
      customerName: customerDetails?.name ?? null,
      customerEmail: customerDetails?.email ?? null,
      companyName: customerDetails?.company ?? null,
      acceptedAt: qRow.accepted_at ? (qRow.accepted_at instanceof Date ? qRow.accepted_at.toISOString() : qRow.accepted_at) : null,
      acceptedByName: qRow.accepted_by_name ?? null,
      issuedAt: qRow.issued_at instanceof Date ? qRow.issued_at.toISOString() : qRow.issued_at,
      expiresAt: qRow.expires_at instanceof Date ? qRow.expires_at.toISOString() : qRow.expires_at,
      lines,
    };
  }

  private mapRowToCustomerQuote(
    qRow: any,
    lRows: any[],
    customerDetails?: { name: string | null; email?: string | null; company: string | null },
  ): CustomerQuoteDto {
    const lines: QuoteLineDto[] = lRows.map((lr) => ({
      id: lr.id,
      catalogProductId: lr.catalog_product_id,
      productCode: lr.product_code,
      productName: lr.product_name,
      description: lr.description,
      category: lr.category,
      billingType: lr.billing_type,
      billingInterval: lr.billing_interval,
      quantity: lr.quantity,
      unitPrice: parseFloat(lr.unit_price),
      lineSubtotal: parseFloat(lr.line_subtotal),
      discountAmount: parseFloat(lr.discount_amount),
      taxableAmount: parseFloat(lr.taxable_amount),
      taxType: lr.tax_type,
      taxRate: parseFloat(lr.tax_rate),
      taxAmount: parseFloat(lr.tax_amount),
      lineTotal: parseFloat(lr.line_total),
    }));

    return {
      id: qRow.id,
      quoteNumber: qRow.quote_number,
      currency: qRow.currency,
      status: qRow.status,
      subtotal: parseFloat(qRow.subtotal),
      discountTotal: parseFloat(qRow.discount_total),
      taxableAmount: parseFloat(qRow.taxable_amount),
      cgstTotal: parseFloat(qRow.cgst_total),
      sgstTotal: parseFloat(qRow.sgst_total),
      igstTotal: parseFloat(qRow.igst_total),
      taxTotal: parseFloat(qRow.tax_total),
      grandTotal: parseFloat(qRow.grand_total),
      taxClassification: qRow.tax_classification,
      sellerJurisdiction: qRow.seller_jurisdiction,
      customerJurisdiction: qRow.customer_jurisdiction,
      notes: qRow.notes,
      customerName: customerDetails?.name ?? null,
      companyName: customerDetails?.company ?? null,
      acceptedAt: qRow.accepted_at ? (qRow.accepted_at instanceof Date ? qRow.accepted_at.toISOString() : qRow.accepted_at) : null,
      acceptedByName: qRow.accepted_by_name ?? null,
      issuedAt: qRow.issued_at instanceof Date ? qRow.issued_at.toISOString() : qRow.issued_at,
      expiresAt: qRow.expires_at instanceof Date ? qRow.expires_at.toISOString() : qRow.expires_at,
      lines,
    };
  }
}
