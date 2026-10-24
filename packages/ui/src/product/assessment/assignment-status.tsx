import React, { forwardRef } from 'react';
import { Badge, BadgeProps } from '../../components/badge';

export type AssignmentStatus =
  | 'invited'
  | 'window_not_open'
  | 'ready'
  | 'in_progress'
  | 'disconnected'
  | 'submitted'
  | 'expired'
  | 'revoked';

export interface AssignmentStatusProps extends Omit<BadgeProps, 'variant'> {
  status: AssignmentStatus;
}

const assignmentConfig: Record<AssignmentStatus, { label: string; variant: BadgeProps['variant'] }> = {
  invited: { label: 'Invited', variant: 'default' },
  window_not_open: { label: 'Window Not Open', variant: 'warning' },
  ready: { label: 'Ready to Start', variant: 'info' },
  in_progress: { label: 'In Progress', variant: 'primary' },
  disconnected: { label: 'Disconnected', variant: 'warning' },
  submitted: { label: 'Submitted', variant: 'success' },
  expired: { label: 'Expired', variant: 'default' },
  revoked: { label: 'Revoked', variant: 'danger' },
};

export const AssignmentStatusBadge = forwardRef<HTMLSpanElement, AssignmentStatusProps>(
  ({ status, className = '', ...props }, ref) => {
    const cfg = assignmentConfig[status] || assignmentConfig.invited;

    return (
      <Badge ref={ref} variant={cfg.variant} dot className={className} {...props}>
        {cfg.label}
      </Badge>
    );
  }
);
AssignmentStatusBadge.displayName = 'AssignmentStatusBadge';

export const AssignmentStatus = AssignmentStatusBadge;

