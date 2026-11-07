'use client';

import React from 'react';
import { Drawer, Badge, Button } from '@hs/ui';
import { type AuditEventDto } from '@hs/contracts';
import { Hash, Shield, Globe, Clock, User, Building, Copy, Check } from 'lucide-react';

export interface AuditDetailDrawerProps {
  event: AuditEventDto | null;
  open: boolean;
  onClose: () => void;
}

export function AuditDetailDrawer({ event, open, onClose }: AuditDetailDrawerProps) {
  const [copiedHash, setCopiedHash] = React.useState<string | null>(null);

  if (!event) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-neutral-700" />
          <span>Audit Event #{event.id}</span>
        </div>
      }
      description={`Captured at ${new Date(event.at).toLocaleString()} (UTC)`}
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      }
      data-testid="audit-detail-drawer"
    >
      <div className="space-y-6 text-xs text-neutral-700">
        {/* Core Action & Entity Banner */}
        <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
                Action:
              </span>
              <span className="font-mono font-semibold text-neutral-900 bg-white px-2.5 py-1 rounded border border-neutral-200 shadow-2xs">
                {event.action}
              </span>
            </div>
            <Badge variant="default" size="sm">
              {event.actor_role}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-200/60 text-[11px]">
            <div>
              <span className="text-neutral-500">Target Entity:</span>{' '}
              <span className="font-medium text-neutral-900">{event.entity}</span>
            </div>
            <div>
              <span className="text-neutral-500">Entity ID:</span>{' '}
              <span className="font-mono text-neutral-900">{event.entity_id || '—'}</span>
            </div>
          </div>
        </div>

        {/* Actor & Tenancy Metadata */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
            Actor & Tenant Context
          </h4>
          <div className="rounded-xl border border-neutral-200 bg-white p-3 space-y-2">
            <div className="flex items-start gap-2">
              <User className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-neutral-500 text-[11px]">Actor ID / Role:</div>
                <div className="font-mono text-neutral-900 font-medium break-all">
                  {event.actor_id || 'System Anonymous'} ({event.actor_role})
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 pt-2 border-t border-neutral-100">
              <Building className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-neutral-500 text-[11px]">Organization ID:</div>
                <div className="font-mono text-neutral-900 font-medium break-all">
                  {event.org_id || 'Global Platform (Null Tenant)'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Network & Tracing */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
            Network & Request Tracing
          </h4>
          <div className="rounded-xl border border-neutral-200 bg-white p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Globe className="w-4 h-4 text-neutral-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="text-neutral-500 text-[11px]">Client IP / User Agent:</div>
                <div className="font-mono text-neutral-900 font-medium">
                  {event.ip || 'Unknown IP'}
                </div>
                {event.user_agent && (
                  <div className="text-[11px] text-neutral-500 font-mono mt-0.5 break-all">
                    {event.user_agent}
                  </div>
                )}
              </div>
            </div>

            {event.request_id && (
              <div className="pt-2 border-t border-neutral-100">
                <div className="text-neutral-500 text-[11px]">Request ID:</div>
                <div className="font-mono text-neutral-900 font-medium break-all">
                  {event.request_id}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cryptographic Ledger Verification Hashes */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
            Cryptographic Hash Chain (BR-31)
          </h4>
          <div className="rounded-xl border border-neutral-200 bg-white p-3 space-y-3 font-mono text-[11px]">
            <div>
              <div className="flex items-center justify-between text-neutral-500 font-sans text-xs mb-1">
                <span>Previous Block Hash (prev_hash):</span>
                {event.prev_hash && (
                  <button
                    type="button"
                    onClick={() => handleCopy(event.prev_hash!, 'prev')}
                    className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 cursor-pointer"
                  >
                    {copiedHash === 'prev' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedHash === 'prev' ? 'Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <div className="rounded bg-neutral-50 p-2 text-neutral-800 break-all border border-neutral-200/60">
                {event.prev_hash || '<Genesis Block (Buffer.alloc(0))>'}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-neutral-500 font-sans text-xs mb-1">
                <span>Current Block Hash (sha256):</span>
                <button
                  type="button"
                  onClick={() => handleCopy(event.hash, 'hash')}
                  className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 cursor-pointer"
                >
                  {copiedHash === 'hash' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedHash === 'hash' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="rounded bg-emerald-50/70 p-2 text-emerald-900 font-semibold break-all border border-emerald-200">
                {event.hash}
              </div>
            </div>
          </div>
        </div>

        {/* State Changes: Before & After JSON */}
        <div className="space-y-3">
          <h4 className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
            State Changes (Before & After)
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
                Before State
              </span>
              <div className="rounded-xl border border-neutral-200 bg-neutral-900 text-neutral-100 p-3 font-mono text-[11px] max-h-64 overflow-y-auto shadow-inner">
                {event.before ? (
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(event.before, null, 2)}
                  </pre>
                ) : (
                  <span className="text-neutral-500 italic">null (No prior state recorded)</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
                After State
              </span>
              <div className="rounded-xl border border-neutral-200 bg-neutral-900 text-neutral-100 p-3 font-mono text-[11px] max-h-64 overflow-y-auto shadow-inner">
                {event.after ? (
                  <pre className="whitespace-pre-wrap break-all">
                    {JSON.stringify(event.after, null, 2)}
                  </pre>
                ) : (
                  <span className="text-neutral-500 italic">null (No target state recorded)</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
