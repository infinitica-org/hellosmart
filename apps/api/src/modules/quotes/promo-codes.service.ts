import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import type {
  CreatePromoCodeDto,
  Currency,
  PromoCode,
} from '@hs/contracts';
import { PG_PLATFORM_POOL } from '../database/database.tokens.js';
import { problem } from '../../common/errors/app-http.exception.js';

export interface EvaluatedPromoItem {
  catalogProductId: string;
  category: string;
  billingType: string;
  lineSubtotal: number;
}

export interface PromoEvaluationResult {
  promoCodeId: string;
  promoCode: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  totalDiscount: number;
  lineDiscounts: Map<string, number>; // catalogProductId -> discount
}

function roundToTwo(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class PromoCodesService {
  constructor(
    @Inject(PG_PLATFORM_POOL) private readonly pool: Pool,
  ) {}

  async listPromoCodes(): Promise<PromoCode[]> {
    const res = await this.pool.query(
      `SELECT * FROM app.promo_codes ORDER BY created_at DESC`,
    );
    return res.rows.map(this.mapRowToPromo);
  }

  async createPromoCode(dto: CreatePromoCodeDto): Promise<PromoCode> {
    const cleanCode = dto.code.trim().toUpperCase();

    // Check code uniqueness
    const existing = await this.pool.query(
      `SELECT 1 FROM app.promo_codes WHERE code = $1`,
      [cleanCode],
    );
    if (existing.rows.length > 0) {
      throw problem({
        title: 'Conflict',
        status: 409,
        detail: `Promo code '${cleanCode}' already exists`,
        code: 'PROMO_CODE_EXISTS',
      });
    }

    const res = await this.pool.query(
      `INSERT INTO app.promo_codes (
         code, description, discount_type, discount_value, currency,
         max_uses, eligible_categories, billing_type_restriction,
         valid_from, valid_until, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, clock_timestamp() - interval '1 minute'), $10, $11)
       RETURNING *`,
      [
        cleanCode,
        dto.description || null,
        dto.discountType,
        dto.discountValue,
        dto.currency || null,
        dto.maxUses || null,
        dto.eligibleCategories || null,
        dto.billingTypeRestriction || null,
        dto.validFrom || null,
        dto.validUntil,
        dto.isActive ?? true,
      ],
    );

    return this.mapRowToPromo(res.rows[0]);
  }

  /**
   * Validates promo code and calculates discount allocation across line items.
   */
  async evaluatePromo(params: {
    code: string;
    currency: Currency;
    items: EvaluatedPromoItem[];
    client?: PoolClient;
  }): Promise<PromoEvaluationResult> {
    const cleanCode = params.code.trim().toUpperCase();
    const queryRunner = params.client || this.pool;

    const res = await queryRunner.query(
      `SELECT * FROM app.promo_codes WHERE code = $1`,
      [cleanCode],
    );

    if (res.rows.length === 0) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: `Promotional code '${cleanCode}' does not exist`,
        code: 'PROMO_CODE_NOT_FOUND',
      });
    }

    const promo = res.rows[0];

    // 1. Active status check
    if (!promo.is_active) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: `Promotional code '${cleanCode}' is inactive`,
        code: 'PROMO_CODE_INACTIVE',
      });
    }

    // 2. Validity window check (with 5-second clock tolerance for start time)
    const now = Date.now();
    const validFrom = new Date(promo.valid_from).getTime();
    const validUntil = new Date(promo.valid_until).getTime();

    if (now + 5000 < validFrom || now > validUntil) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: `Promotional code '${cleanCode}' has expired or is not yet active`,
        code: 'PROMO_CODE_EXPIRED',
      });
    }

    // 3. Maximum usage cap check
    if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: `Promotional code '${cleanCode}' has reached its maximum redemption limit`,
        code: 'PROMO_MAX_USES_REACHED',
      });
    }

    // 4. Currency compatibility check
    if (promo.currency && promo.currency !== params.currency) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: `Promotional code '${cleanCode}' is valid only for ${promo.currency}, not ${params.currency}`,
        code: 'PROMO_CURRENCY_MISMATCH',
      });
    }

    // 5. Eligible line items filter
    const eligibleCategories = Array.isArray(promo.eligible_categories) && promo.eligible_categories.length > 0
      ? new Set(promo.eligible_categories)
      : null;
    const billingRestriction = promo.billing_type_restriction;

    const eligibleItems = params.items.filter((item) => {
      if (eligibleCategories && !eligibleCategories.has(item.category)) {
        return false;
      }
      if (billingRestriction && item.billingType !== billingRestriction) {
        return false;
      }
      return true;
    });

    if (eligibleItems.length === 0) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: `Promotional code '${cleanCode}' is not applicable to any of the items in this quote`,
        code: 'PROMO_INELIGIBLE_ITEMS',
      });
    }

    const eligibleSubtotal = roundToTwo(
      eligibleItems.reduce((sum, item) => sum + item.lineSubtotal, 0),
    );

    const discountType = promo.discount_type as 'percentage' | 'fixed';
    const discountValue = parseFloat(promo.discount_value);
    const lineDiscounts = new Map<string, number>();
    let totalDiscount = 0;

    if (discountType === 'percentage') {
      const rate = discountValue / 100;
      for (const item of eligibleItems) {
        const itemDisc = roundToTwo(item.lineSubtotal * rate);
        lineDiscounts.set(item.catalogProductId, itemDisc);
        totalDiscount = roundToTwo(totalDiscount + itemDisc);
      }
    } else {
      // Fixed discount: capped at eligible subtotal
      const appliedFixed = Math.min(discountValue, eligibleSubtotal);
      totalDiscount = appliedFixed;

      // Allocate proportionally across eligible items
      let allocatedSoFar = 0;
      for (let i = 0; i < eligibleItems.length; i++) {
        const item = eligibleItems[i];
        if (!item) continue;
        if (i === eligibleItems.length - 1) {
          // Final line gets remainder to avoid rounding mismatch
          const remainder = roundToTwo(appliedFixed - allocatedSoFar);
          lineDiscounts.set(item.catalogProductId, remainder);
        } else {
          const prop = roundToTwo((item.lineSubtotal / eligibleSubtotal) * appliedFixed);
          lineDiscounts.set(item.catalogProductId, prop);
          allocatedSoFar = roundToTwo(allocatedSoFar + prop);
        }
      }
    }

    return {
      promoCodeId: promo.id,
      promoCode: promo.code,
      discountType,
      discountValue,
      totalDiscount,
      lineDiscounts,
    };
  }

  /**
   * Atomically consumes promo redemption in a transaction with row-level locking.
   */
  async redeemPromoAtomic(params: {
    client: PoolClient;
    promoCodeId: string;
    quoteId: string;
    discountApplied: number;
  }): Promise<void> {
    const { client, promoCodeId, quoteId, discountApplied } = params;

    // Acquire row lock
    const res = await client.query(
      `SELECT id, current_uses, max_uses, is_active FROM app.promo_codes WHERE id = $1 FOR UPDATE`,
      [promoCodeId],
    );

    if (res.rows.length === 0) {
      throw new Error(`Promo code ${promoCodeId} not found during redemption`);
    }

    const row = res.rows[0];
    if (!row.is_active) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Promo code is inactive',
        code: 'PROMO_CODE_INACTIVE',
      });
    }

    if (row.max_uses !== null && row.current_uses >= row.max_uses) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Promo code has reached maximum usage limit',
        code: 'PROMO_MAX_USES_REACHED',
      });
    }

    // Increment usage
    await client.query(
      `UPDATE app.promo_codes
       SET current_uses = current_uses + 1, updated_at = clock_timestamp()
       WHERE id = $1`,
      [promoCodeId],
    );

    // Record redemption
    await client.query(
      `INSERT INTO app.promo_redemptions (promo_code_id, quote_id, discount_applied)
       VALUES ($1, $2, $3)`,
      [promoCodeId, quoteId, discountApplied],
    );
  }

  private mapRowToPromo(row: any): PromoCode {
    return {
      id: row.id,
      code: row.code,
      description: row.description,
      discountType: row.discount_type,
      discountValue: parseFloat(row.discount_value),
      currency: row.currency,
      maxUses: row.max_uses,
      currentUses: row.current_uses,
      eligibleCategories: row.eligible_categories,
      billingTypeRestriction: row.billing_type_restriction,
      validFrom: row.valid_from instanceof Date ? row.valid_from.toISOString() : row.valid_from,
      validUntil: row.valid_until instanceof Date ? row.valid_until.toISOString() : row.valid_until,
      isActive: row.is_active,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
  }
}
