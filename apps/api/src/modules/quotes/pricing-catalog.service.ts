import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';
import type {
  CreatePricingCatalogItemDto,
  Currency,
  PricingCatalogItem,
  UpdatePricingCatalogItemDto,
} from '@hs/contracts';
import { PG_PLATFORM_POOL } from '../database/database.tokens.js';
import { problem } from '../../common/errors/app-http.exception.js';

@Injectable()
export class PricingCatalogService {
  constructor(
    @Inject(PG_PLATFORM_POOL) private readonly pool: Pool,
  ) {}

  async listCatalog(filter?: {
    isActive?: boolean | undefined;
    category?: string | undefined;
    currency?: Currency | undefined;
  }): Promise<PricingCatalogItem[]> {
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filter?.isActive !== undefined) {
      conditions.push(`is_active = $${idx++}`);
      values.push(filter.isActive);
    }
    if (filter?.category) {
      conditions.push(`category = $${idx++}`);
      values.push(filter.category);
    }
    if (filter?.currency) {
      conditions.push(`currency = $${idx++}`);
      values.push(filter.currency);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await this.pool.query(
      `SELECT * FROM app.pricing_catalog ${whereClause} ORDER BY category ASC, unit_price ASC`,
      values,
    );

    return res.rows.map(this.mapRowToItem);
  }

  async getCatalogItemById(id: string): Promise<PricingCatalogItem | null> {
    const res = await this.pool.query(
      `SELECT * FROM app.pricing_catalog WHERE id = $1`,
      [id],
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToItem(res.rows[0]);
  }

  async createCatalogItem(dto: CreatePricingCatalogItemDto): Promise<PricingCatalogItem> {
    // 1. Check code uniqueness
    const existing = await this.pool.query(
      `SELECT 1 FROM app.pricing_catalog WHERE code = $1`,
      [dto.code],
    );
    if (existing.rows.length > 0) {
      throw problem({
        title: 'Conflict',
        status: 409,
        detail: `Product code '${dto.code}' already exists`,
        code: 'CATALOG_CODE_EXISTS',
      });
    }

    const res = await this.pool.query(
      `INSERT INTO app.pricing_catalog (
         code, name, description, category, currency, unit_price,
         billing_type, billing_interval, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        dto.code,
        dto.name,
        dto.description || null,
        dto.category,
        dto.currency,
        dto.unitPrice,
        dto.billingType,
        dto.billingInterval || null,
        dto.isActive ?? true,
      ],
    );

    return this.mapRowToItem(res.rows[0]);
  }

  async updateCatalogItem(id: string, dto: UpdatePricingCatalogItemDto): Promise<PricingCatalogItem> {
    const existing = await this.getCatalogItemById(id);
    if (!existing) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: `Catalog product '${id}' not found`,
        code: 'PRODUCT_NOT_FOUND',
      });
    }

    const effectiveBillingType = dto.billingType ?? existing.billingType;
    const effectiveBillingInterval =
      dto.billingInterval !== undefined ? dto.billingInterval : existing.billingInterval;

    if (effectiveBillingType === 'recurring' && !effectiveBillingInterval) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Recurring products require a billingInterval (month or year)',
        code: 'VALIDATION_ERROR',
      });
    }
    if (effectiveBillingType === 'one_time' && effectiveBillingInterval) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'One-time products must not specify a billingInterval',
        code: 'VALIDATION_ERROR',
      });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (dto.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(dto.name);
    }
    if (dto.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(dto.description);
    }
    if (dto.category !== undefined) {
      updates.push(`category = $${idx++}`);
      values.push(dto.category);
    }
    if (dto.currency !== undefined) {
      updates.push(`currency = $${idx++}`);
      values.push(dto.currency);
    }
    if (dto.unitPrice !== undefined) {
      updates.push(`unit_price = $${idx++}`);
      values.push(dto.unitPrice);
    }
    if (dto.billingType !== undefined) {
      updates.push(`billing_type = $${idx++}`);
      values.push(dto.billingType);
    }
    if (dto.billingInterval !== undefined) {
      updates.push(`billing_interval = $${idx++}`);
      values.push(dto.billingInterval);
    }
    if (dto.isActive !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(dto.isActive);
    }

    if (updates.length === 0) {
      return existing;
    }

    updates.push(`updated_at = clock_timestamp()`);
    values.push(id);

    const res = await this.pool.query(
      `UPDATE app.pricing_catalog
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING *`,
      values,
    );

    return this.mapRowToItem(res.rows[0]);
  }

  async setCatalogItemStatus(id: string, isActive: boolean): Promise<PricingCatalogItem> {
    const existing = await this.getCatalogItemById(id);
    if (!existing) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: `Catalog product '${id}' not found`,
        code: 'PRODUCT_NOT_FOUND',
      });
    }

    const res = await this.pool.query(
      `UPDATE app.pricing_catalog
       SET is_active = $1, updated_at = clock_timestamp()
       WHERE id = $2
       RETURNING *`,
      [isActive, id],
    );

    return this.mapRowToItem(res.rows[0]);
  }

  private mapRowToItem(row: any): PricingCatalogItem {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      category: row.category,
      currency: row.currency,
      unitPrice: parseFloat(row.unit_price),
      billingType: row.billing_type,
      billingInterval: row.billing_interval,
      isActive: row.is_active,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    };
  }
}
