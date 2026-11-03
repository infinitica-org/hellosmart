import crypto from 'node:crypto';
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
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
  ) {}

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
      const leadCheck = await this.pool.query(
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
      const orgCheck = await this.pool.query(
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
           promo_code_id, notes, public_token_hash, issued_at, expires_at, created_by
         ) VALUES (
           $1, $2, $3, $4, 'draft',
           $5, $6, $7, $8, $9, $10,
           $11, $12, $13, $14::jsonb, $15::jsonb,
           $16, $17, $18, $19, $20, $21
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

    return {
      quote: createdQuote,
      publicToken: rawToken,
      publicUrl: `/quotes/${rawToken}`,
    };
  }

  async getQuoteById(id: string): Promise<QuoteDto | null> {
    const quoteRes = await this.pool.query(
      `SELECT * FROM app.quotes WHERE id = $1`,
      [id],
    );
    if (quoteRes.rows.length === 0) return null;

    const linesRes = await this.pool.query(
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
    const quoteRes = await this.pool.query(
      `SELECT * FROM app.quotes WHERE public_token_hash = $1`,
      [tokenHash],
    );
    if (quoteRes.rows.length === 0) return null;

    const quoteRow = quoteRes.rows[0];

    // If past expiration and still in 'issued' status, transition to 'expired'
    const isExpired = new Date(quoteRow.expires_at).getTime() < Date.now();
    if (isExpired && quoteRow.status === 'issued') {
      await this.pool.query(
        `UPDATE app.quotes SET status = 'expired', updated_at = clock_timestamp() WHERE id = $1`,
        [quoteRow.id],
      );
      quoteRow.status = 'expired';
    }

    const linesRes = await this.pool.query(
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
        const linesRes = await this.pool.query(
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

      const linesRes = await this.pool.query(
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
    const res = await this.pool.query(
      `SELECT * FROM app.quotes ${whereClause} ORDER BY created_at DESC`,
      values,
    );

    const quotes: QuoteDto[] = [];
    for (const row of res.rows) {
      const linesRes = await this.pool.query(
        `SELECT * FROM app.quote_lines WHERE quote_id = $1 ORDER BY created_at ASC`,
        [row.id],
      );
      const customerDetails = await this.resolveCustomerDetails(this.pool, row);
      quotes.push(this.mapRowToQuote(row, linesRes.rows, customerDetails));
    }

    return quotes;
  }

  private async resolveCustomerDetails(
    clientOrPool: Pool | PoolClient,
    qRow: any,
  ): Promise<{ name: string | null; email: string | null; company: string | null }> {
    if (qRow.lead_id) {
      try {
        const leadRes = await clientOrPool.query(
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
        const orgRes = await clientOrPool.query(
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
