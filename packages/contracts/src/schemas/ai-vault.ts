import { z } from 'zod';

export const AiProviderSchema = z.enum(['openai', 'anthropic', 'gemini', 'deepseek']);
export type AiProvider = z.infer<typeof AiProviderSchema>;

export const PlatformKeyStatusSchema = z.enum(['active', 'inactive', 'revoked']);
export type PlatformKeyStatus = z.infer<typeof PlatformKeyStatusSchema>;

export const AllocationStatusSchema = z.enum(['active', 'exhausted', 'revoked', 'expired']);
export type AllocationStatus = z.infer<typeof AllocationStatusSchema>;

// Input DTO to register a key in the vault (only place raw apiKey is accepted)
export const CreatePlatformAiKeyDtoSchema = z.object({
  provider: AiProviderSchema,
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  apiKey: z.string().min(8, 'API key must be at least 8 characters').max(500),
  description: z.string().max(500).optional(),
});
export type CreatePlatformAiKeyDto = z.infer<typeof CreatePlatformAiKeyDtoSchema>;

// Input DTO to update or rotate a vault key
export const UpdatePlatformAiKeyDtoSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  status: PlatformKeyStatusSchema.optional(),
  apiKey: z.string().min(8).max(500).optional(), // optional rotation
  description: z.string().max(500).optional(),
});
export type UpdatePlatformAiKeyDto = z.infer<typeof UpdatePlatformAiKeyDtoSchema>;

// Vault Key representation (NO secret, NO ciphertext — strictly masked)
export const PlatformAiKeyDtoSchema = z.object({
  id: z.string().uuid(),
  provider: AiProviderSchema,
  name: z.string(),
  maskedKey: z.string(), // e.g. "sk-...4821" or "AIza...9910"
  keyLast4: z.string().length(4),
  status: PlatformKeyStatusSchema,
  isActive: z.boolean(),
  description: z.string().nullable().optional(),
  totalAllocatedCents: z.number().int().nonnegative().default(0),
  activeAllocationsCount: z.number().int().nonnegative().default(0),
  lastTestedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PlatformAiKeyDto = z.infer<typeof PlatformAiKeyDtoSchema>;

// Input DTO to allocate credits to a tenant
export const CreateCreditAllocationDtoSchema = z.object({
  orgId: z.string().uuid('Invalid organization ID'),
  platformKeyId: z.string().uuid('Invalid platform key ID'),
  allocatedAmountCents: z.number().int().positive('Allocated amount must be at least 1 cent').max(100000000), // up to $1,000,000
  markupPercentage: z.number().min(0).max(500).default(15.0),
  tokenCap: z.number().int().positive().optional(),
  spendCapCents: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).optional(),
});
export type CreateCreditAllocationDto = z.infer<typeof CreateCreditAllocationDtoSchema>;

// Input DTO to adjust credit allocation (positive or negative delta)
export const AdjustCreditAllocationDtoSchema = z.object({
  adjustmentAmountCents: z.number().int().refine((val) => val !== 0, {
    message: 'Adjustment amount must be non-zero',
  }),
  reason: z.string().min(3, 'Reason is required').max(500),
  markupPercentage: z.number().min(0).max(500).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});
export type AdjustCreditAllocationDto = z.infer<typeof AdjustCreditAllocationDtoSchema>;

// Credit allocation representation
export const CreditAllocationDtoSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  orgName: z.string(),
  platformKeyId: z.string().uuid(),
  platformKeyName: z.string(),
  provider: AiProviderSchema,
  maskedKey: z.string(),
  allocatedAmountCents: z.number().int().nonnegative(),
  usedAmountCents: z.number().int().nonnegative(),
  balanceCents: z.number().int().nonnegative(),
  markupPercentage: z.number().nonnegative(),
  tokenCap: z.number().int().nullable().optional(),
  spendCapCents: z.number().int().nullable().optional(),
  status: AllocationStatusSchema,
  notes: z.string().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CreditAllocationDto = z.infer<typeof CreditAllocationDtoSchema>;

// Overview stats for the credit allocation manager
export const PlatformAiVaultStatsDtoSchema = z.object({
  totalKeys: z.number().int().nonnegative(),
  activeKeys: z.number().int().nonnegative(),
  totalAllocations: z.number().int().nonnegative(),
  totalAllocatedCents: z.number().int().nonnegative(),
  totalUsedCents: z.number().int().nonnegative(),
  totalRemainingBalanceCents: z.number().int().nonnegative(),
});
export type PlatformAiVaultStatsDto = z.infer<typeof PlatformAiVaultStatsDtoSchema>;
