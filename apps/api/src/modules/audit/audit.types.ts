export interface AuditRecordInput {
  actorId: string | null;
  actorRole: string;
  orgId: string | null;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}
