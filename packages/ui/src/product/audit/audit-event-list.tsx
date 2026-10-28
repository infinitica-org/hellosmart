import React, { forwardRef, HTMLAttributes } from 'react';

export interface AuditEventItem {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entity: string;
  at: string | Date;
  ip?: string | undefined;
}

export interface AuditEventListProps extends HTMLAttributes<HTMLDivElement> {
  events: AuditEventItem[];
}

export const AuditEventList = forwardRef<HTMLDivElement, AuditEventListProps>(
  ({ events, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`w-full rounded-2xl border border-neutral-200 bg-white shadow-xs overflow-hidden ${className}`}
        {...props}
      >
        <div className="px-5 py-3.5 bg-neutral-50 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-neutral-900">
              Append-Only Audit Trail (BR-31)
            </span>
          </div>
          <span className="text-[11px] text-neutral-500 font-mono">
            {events.length} logged actions
          </span>
        </div>

        <div className="divide-y divide-neutral-200 max-h-96 overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500">
              No audit log entries recorded.
            </div>
          ) : (
            events.map((evt) => (
              <div
                key={evt.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-neutral-50 transition-colors text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">
                    {evt.action}
                  </span>
                  <div>
                    <span className="font-medium text-neutral-900">{evt.actorEmail}</span>
                    <span className="text-neutral-500 text-[11px] ml-1.5">({evt.actorRole})</span>
                    <span className="text-neutral-600 text-[11px] ml-2 font-mono">
                      on {evt.entity}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-neutral-500 text-[11px] font-mono shrink-0">
                  {evt.ip && <span>IP: {evt.ip}</span>}
                  <span suppressHydrationWarning>
                    {typeof evt.at === 'string' ? evt.at.replace('T', ' ').replace('Z', ' UTC') : new Date(evt.at).toISOString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }
);
AuditEventList.displayName = 'AuditEventList';

