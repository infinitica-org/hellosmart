'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { ActiveSession } from '@hs/contracts';
import { sessionClient } from '@/lib/session-client';

export interface ActiveSessionsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActiveSessionsDialog({
  isOpen,
  onClose,
}: ActiveSessionsDialogProps): React.JSX.Element | null {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await sessionClient.getActiveSessions();
      setSessions(data.sessions || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load active sessions';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen, fetchSessions]);

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    setError(null);
    try {
      const success = await sessionClient.revoke(sessionId);
      if (success) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } else {
        setError('Failed to revoke session. Please try again.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error revoking session';
      setError(msg);
    } finally {
      setRevokingId(null);
    }
  };

  const formatDate = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="active-sessions-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="space-y-0.5">
            <h2 id="active-sessions-title" className="text-lg font-bold text-slate-900">
              Active Sessions
            </h2>
            <p className="text-xs text-slate-500">
              Devices currently signed into your HelloSmart account.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700" role="alert">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-center space-y-2 text-slate-500 text-sm">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-r-transparent" />
            <p>Loading active sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">
            No active sessions found.
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                  session.isCurrent
                    ? 'bg-indigo-50/50 border-indigo-200'
                    : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-50'
                }`}
              >
                <div className="space-y-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900 truncate">
                      {session.device || session.userAgent || 'Web Browser'}
                    </span>
                    {session.isCurrent && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                        This device
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>IP: {session.ipAddress || '127.0.0.1'}</span>
                    <span>•</span>
                    <span>Active: {formatDate(session.lastActiveAt)}</span>
                  </div>
                </div>

                {!session.isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(session.id)}
                    disabled={revokingId === session.id}
                    className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    {revokingId === session.id ? 'Revoking...' : 'Revoke'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

