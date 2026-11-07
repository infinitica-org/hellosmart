import { z } from 'zod';

const optionalUuid = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
  z.string().uuid().optional(),
);

const optionalString = z.preprocess(
  (val) => (typeof val === 'string' && val.trim() === '' ? undefined : val),
  z.string().optional(),
);

export const AuditLogQueryDtoSchema = z.object({
  actor_id: optionalUuid,
  actor_role: optionalString,
  org_id: optionalUuid,
  entity: optionalString,
  entity_id: optionalString,
  action: optionalString,
  start_date: optionalString,
  end_date: optionalString,
  search: optionalString,
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});

export type AuditLogQueryDto = z.infer<typeof AuditLogQueryDtoSchema>;

export const AuditEventDtoSchema = z.object({
  id: z.string(),
  at: z.string(),
  actor_id: z.string().nullable(),
  actor_role: z.string(),
  org_id: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entity_id: z.string().nullable(),
  before: z.record(z.any()).nullable(),
  after: z.record(z.any()).nullable(),
  ip: z.string().nullable(),
  user_agent: z.string().nullable(),
  request_id: z.string().nullable(),
  prev_hash: z.string().nullable(),
  hash: z.string(),
});

export type AuditEventDto = z.infer<typeof AuditEventDtoSchema>;

export const PaginatedAuditLogDtoSchema = z.object({
  items: z.array(AuditEventDtoSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  total_pages: z.number().int().nonnegative(),
});

export type PaginatedAuditLogDto = z.infer<typeof PaginatedAuditLogDtoSchema>;

export const AuditVerifyStatusSchema = z.enum([
  'valid',
  'tampered',
  'inconclusive',
  'empty',
]);

export type AuditVerifyStatus = z.infer<typeof AuditVerifyStatusSchema>;

export const AuditVerifyResponseDtoSchema = z.object({
  status: AuditVerifyStatusSchema,
  valid: z.boolean(),
  verified_at: z.string(),
  records_checked: z.number().int().nonnegative(),
  records_verified_before_issue: z.number().int().nonnegative().optional(),
  chain_start: z.string().nullable(),
  chain_end: z.string().nullable(),
  first_invalid_event_id: z.string().nullable().optional(),
  first_invalid_event_timestamp: z.string().nullable().optional(),
  first_inconclusive_event_id: z.string().nullable().optional(),
  first_inconclusive_event_timestamp: z.string().nullable().optional(),
  failure_reason: z.string().nullable().optional(),
  inconclusive_reason: z.string().nullable().optional(),
  expected_hash: z.string().nullable().optional(),
  stored_hash: z.string().nullable().optional(),
  expected_previous_hash: z.string().nullable().optional(),
  stored_previous_hash: z.string().nullable().optional(),
  tamper_type: z
    .enum([
      'none',
      'hash_mismatch',
      'prev_hash_mismatch',
      'broken_link',
      'invalid_genesis',
      'empty_chain',
      'indeterminate_serialization',
      'unknown_provenance',
    ])
    .optional(),
});

export type AuditVerifyResponseDto = z.infer<typeof AuditVerifyResponseDtoSchema>;
