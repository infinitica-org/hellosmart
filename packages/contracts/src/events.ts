export type DomainEventType =
  | 'candidate.created'
  | 'assignment.published'
  | 'workspace.requested'
  | 'workspace.connected'
  | 'workspace.disconnected'
  | 'workspace.destroy_requested'
  | 'assignment.deadline_reached'
  | 'submission.created'
  | 'review.agent_run_requested'
  | 'review.report_ready'
  | 'review.released'
  | 'payment.succeeded'
  | 'payment.failed'
  | 'entitlements.changed'
  | 'retention.purge_due';

export interface DomainEvent<T = Record<string, unknown>> {
  type: DomainEventType;
  version: number;
  dedupeId: string;
  orgId: string;
  occurredAt: string;
  actor?: {
    id: string;
    role: string;
  };
  data: T;
}
