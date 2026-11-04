import { z } from 'zod';

export const ProductCategoryEnum = z.enum(['plan', 'custom_template', 'addon']);
export type ProductCategory = z.infer<typeof ProductCategoryEnum>;

export const CurrencyEnum = z.enum(['INR', 'USD']);
export type Currency = z.infer<typeof CurrencyEnum>;

export const BillingTypeEnum = z.enum(['recurring', 'one_time']);
export type BillingType = z.infer<typeof BillingTypeEnum>;

export const BillingIntervalEnum = z.enum(['month', 'year']);
export type BillingInterval = z.infer<typeof BillingIntervalEnum>;

export const DiscountTypeEnum = z.enum(['percentage', 'fixed']);
export type DiscountType = z.infer<typeof DiscountTypeEnum>;

export const TaxClassificationEnum = z.enum(['intra_state', 'inter_state', 'export', 'exempt']);
export type TaxClassification = z.infer<typeof TaxClassificationEnum>;

export const TaxTypeEnum = z.enum(['cgst_sgst', 'igst', 'none']);
export type TaxType = z.infer<typeof TaxTypeEnum>;

export const QuoteStatusEnum = z.enum([
  'draft',
  'issued',
  'accepted',
  'rejected',
  'expired',
  'superseded',
]);
export type QuoteStatus = z.infer<typeof QuoteStatusEnum>;

// --- Tax Jurisdiction ---
export const TaxJurisdictionSchema = z.object({
  country: z.string().min(2).max(2).toUpperCase(),
  state: z.string().min(1).max(10).toUpperCase().optional(),
  city: z.string().max(100).optional(),
  pinCode: z.string().max(20).optional(),
  gstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid Indian GSTIN format')
    .optional(),
});
export type TaxJurisdiction = z.infer<typeof TaxJurisdictionSchema>;

// --- Pricing Catalog ---
export const PricingCatalogItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  category: ProductCategoryEnum,
  currency: CurrencyEnum,
  unitPrice: z.number().nonnegative(),
  billingType: BillingTypeEnum,
  billingInterval: BillingIntervalEnum.nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PricingCatalogItem = z.infer<typeof PricingCatalogItemSchema>;

export const CreatePricingCatalogItemDtoSchema = z.object({
  code: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category: ProductCategoryEnum,
  currency: CurrencyEnum,
  unitPrice: z.number().nonnegative(),
  billingType: BillingTypeEnum,
  billingInterval: BillingIntervalEnum.optional(),
  isActive: z.boolean().default(true).optional(),
}).refine(
  (data) => (data.billingType === 'recurring' ? Boolean(data.billingInterval) : !data.billingInterval),
  { message: 'Recurring items require billingInterval; one-time items must not specify billingInterval' },
);
export type CreatePricingCatalogItemDto = z.infer<typeof CreatePricingCatalogItemDtoSchema>;

export const UpdatePricingCatalogItemDtoSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: ProductCategoryEnum.optional(),
  currency: CurrencyEnum.optional(),
  unitPrice: z.number().nonnegative().optional(),
  billingType: BillingTypeEnum.optional(),
  billingInterval: BillingIntervalEnum.nullable().optional(),
  isActive: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.billingType === 'recurring' && data.billingInterval === null) return false;
    if (data.billingType === 'one_time' && data.billingInterval !== null && data.billingInterval !== undefined) return false;
    return true;
  },
  { message: 'Recurring items require billingInterval; one-time items must not specify billingInterval' },
);
export type UpdatePricingCatalogItemDto = z.infer<typeof UpdatePricingCatalogItemDtoSchema>;

// --- Promo Codes ---
export const PromoCodeSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(50),
  description: z.string().nullable().optional(),
  discountType: DiscountTypeEnum,
  discountValue: z.number().positive(),
  currency: CurrencyEnum.nullable().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  currentUses: z.number().int().nonnegative(),
  eligibleCategories: z.array(ProductCategoryEnum).nullable().optional(),
  billingTypeRestriction: BillingTypeEnum.nullable().optional(),
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PromoCode = z.infer<typeof PromoCodeSchema>;

export const CreatePromoCodeDtoSchema = z.object({
  code: z.string().min(1).max(50).toUpperCase(),
  description: z.string().max(500).optional(),
  discountType: DiscountTypeEnum,
  discountValue: z.number().positive(),
  currency: CurrencyEnum.optional(),
  maxUses: z.number().int().positive().optional(),
  eligibleCategories: z.array(ProductCategoryEnum).optional(),
  billingTypeRestriction: BillingTypeEnum.optional(),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime(),
  isActive: z.boolean().default(true).optional(),
}).refine(
  (data) => (data.discountType === 'percentage' ? data.discountValue <= 100 : true),
  { message: 'Percentage discount cannot exceed 100%' },
).refine(
  (data) => (data.discountType === 'fixed' ? Boolean(data.currency) : true),
  { message: 'Fixed monetary discount requires explicit currency' },
);
export type CreatePromoCodeDto = z.infer<typeof CreatePromoCodeDtoSchema>;

// --- Quote Creation & Representations ---
export const QuoteLineItemInputSchema = z.object({
  catalogProductId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
});
export type QuoteLineItemInput = z.infer<typeof QuoteLineItemInputSchema>;

export const CreateQuoteDtoSchema = z.object({
  leadId: z.string().uuid().optional(),
  orgId: z.string().uuid().optional(),
  currency: CurrencyEnum,
  customerJurisdiction: TaxJurisdictionSchema,
  sellerJurisdiction: TaxJurisdictionSchema.optional(),
  items: z.array(QuoteLineItemInputSchema).min(1, 'Quote must include at least one item'),
  promoCode: z.string().min(1).max(50).toUpperCase().optional(),
  notes: z.string().max(1000).optional(),
  expiresInDays: z.number().int().min(1).max(90).default(14).optional(),
}).refine(
  (data) => (data.leadId && !data.orgId) || (!data.leadId && data.orgId),
  { message: 'Exactly one customer reference (leadId or orgId) must be provided' },
);
export type CreateQuoteDto = z.infer<typeof CreateQuoteDtoSchema>;

export const QuoteLineDtoSchema = z.object({
  id: z.string().uuid(),
  catalogProductId: z.string().uuid(),
  productCode: z.string(),
  productName: z.string(),
  description: z.string().nullable().optional(),
  category: ProductCategoryEnum,
  billingType: BillingTypeEnum,
  billingInterval: BillingIntervalEnum.nullable().optional(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  lineSubtotal: z.number().nonnegative(),
  discountAmount: z.number().nonnegative(),
  taxableAmount: z.number().nonnegative(),
  taxType: TaxTypeEnum,
  taxRate: z.number().nonnegative(),
  taxAmount: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
});
export type QuoteLineDto = z.infer<typeof QuoteLineDtoSchema>;

export const QuoteDtoSchema = z.object({
  id: z.string().uuid(),
  quoteNumber: z.string(),
  leadId: z.string().uuid().nullable().optional(),
  orgId: z.string().uuid().nullable().optional(),
  currency: CurrencyEnum,
  status: QuoteStatusEnum,
  subtotal: z.number().nonnegative(),
  discountTotal: z.number().nonnegative(),
  taxableAmount: z.number().nonnegative(),
  cgstTotal: z.number().nonnegative(),
  sgstTotal: z.number().nonnegative(),
  igstTotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative(),
  grandTotal: z.number().nonnegative(),
  taxClassification: TaxClassificationEnum,
  sellerJurisdiction: TaxJurisdictionSchema,
  customerJurisdiction: TaxJurisdictionSchema,
  promoCodeId: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  customerEmail: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  acceptedAt: z.string().datetime().nullable().optional(),
  acceptedByName: z.string().nullable().optional(),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  lines: z.array(QuoteLineDtoSchema),
});
export type QuoteDto = z.infer<typeof QuoteDtoSchema>;

/**
 * Public Customer Quote Representation (CustomerQuoteDto)
 * Minimizes data exposure for public quote review and approval:
 * Excludes internal database IDs (leadId, orgId, promoCodeId) and sensitive contact email (customerEmail).
 * Preserves commercial and statutory GST invoice fields:
 * - quoteNumber
 * - line items, quantities, unit prices, discounts
 * - 18% GST breakdown (cgstTotal, sgstTotal, igstTotal, taxTotal)
 * - customer and seller jurisdictions (state, country, gstin, companyName, customerName)
 * - totals and validity dates (issuedAt, expiresAt)
 */
export const CustomerQuoteDtoSchema = z.object({
  id: z.string().uuid(),
  quoteNumber: z.string(),
  currency: CurrencyEnum,
  status: QuoteStatusEnum,
  subtotal: z.number().nonnegative(),
  discountTotal: z.number().nonnegative(),
  taxableAmount: z.number().nonnegative(),
  cgstTotal: z.number().nonnegative(),
  sgstTotal: z.number().nonnegative(),
  igstTotal: z.number().nonnegative(),
  taxTotal: z.number().nonnegative(),
  grandTotal: z.number().nonnegative(),
  taxClassification: TaxClassificationEnum,
  sellerJurisdiction: TaxJurisdictionSchema,
  customerJurisdiction: TaxJurisdictionSchema,
  notes: z.string().nullable().optional(),
  customerName: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  acceptedAt: z.string().datetime().nullable().optional(),
  acceptedByName: z.string().nullable().optional(),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  lines: z.array(QuoteLineDtoSchema),
});
export type CustomerQuoteDto = z.infer<typeof CustomerQuoteDtoSchema>;

export const CreateQuoteResponseDtoSchema = z.object({
  quote: QuoteDtoSchema,
  publicToken: z.string(),
  publicUrl: z.string(),
});
export type CreateQuoteResponseDto = z.infer<typeof CreateQuoteResponseDtoSchema>;

// --- Quote Acceptance (PHS-I128 / SP-010) ---
export const AcceptQuoteDtoSchema = z.object({
  acceptedByName: z.string().min(1, 'Name is required to approve quotation').max(100).optional(),
  confirmationAcknowledged: z.boolean().refine((val) => val === true, {
    message: 'You must acknowledge and accept the commercial terms',
  }),
});
export type AcceptQuoteDto = z.infer<typeof AcceptQuoteDtoSchema>;

export const AcceptQuoteResponseDtoSchema = z.object({
  success: z.boolean(),
  quote: CustomerQuoteDtoSchema,
  alreadyAccepted: z.boolean(),
  message: z.string(),
});
export type AcceptQuoteResponseDto = z.infer<typeof AcceptQuoteResponseDtoSchema>;
