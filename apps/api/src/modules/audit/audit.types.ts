export interface AuditRecordInput {
  actorId: string | null;
  actorRole: string;
  orgId: string | null;
  action: string;
  entity: string;
  entityId?: string | undefined;
  before?: unknown;
  after?: unknown;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
  requestId?: string | null | undefined;
}
