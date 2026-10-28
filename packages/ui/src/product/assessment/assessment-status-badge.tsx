import React, { forwardRef } from 'react';
import { Badge, BadgeProps } from '../../components/badge';

export type AssessmentStatus = 'draft' | 'dry_run_passed' | 'published' | 'closed' | 'archived';

export interface AssessmentStatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: AssessmentStatus;
}

const statusConfig: Record<AssessmentStatus, { label: string; variant: BadgeProps['variant'] }> = {
  draft: { label: 'Draft', variant: 'default' },
  dry_run_passed: { label: 'Dry Run Passed', variant: 'info' },
  published: { label: 'Published', variant: 'success' },
  closed: { label: 'Closed', variant: 'warning' },
  archived: { label: 'Archived', variant: 'default' },
};

export const AssessmentStatusBadge = forwardRef<HTMLSpanElement, AssessmentStatusBadgeProps>(
  ({ status, className = '', ...props }, ref) => {
    const cfg = statusConfig[status] || statusConfig.draft;

    return (
      <Badge ref={ref} variant={cfg.variant} dot className={className} {...props}>
        {cfg.label}
      </Badge>
    );
  }
);
AssessmentStatusBadge.displayName = 'AssessmentStatusBadge';

