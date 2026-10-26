'use client';

import React from 'react';
import { TEAM_ROLES, TeamRole } from '@/lib/auth';

export function RoleBadge({
  role,
  roles,
}: {
  role?: TeamRole;
  roles?: TeamRole[];
}) {
  const targetRoles = roles || (role ? [role] : ['sde']);

  return (
    <div className="inline-flex flex-wrap items-center gap-2 my-4 px-3 py-1.5 rounded-full border border-fd-border bg-fd-muted/50 backdrop-blur-sm">
      <span className="text-[11px] font-mono text-fd-muted-foreground uppercase tracking-wider">
        Target Role:
      </span>
      {targetRoles.map((r) => {
        const conf = TEAM_ROLES[r] || { name: r, badge: r, color: '#64748b' };
        return (
          <span
            key={r}
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium font-mono border border-fd-border bg-fd-card text-fd-foreground shadow-xs"
          >
            <span>{conf.badge}</span>
          </span>
        );
      })}
    </div>
  );
}
