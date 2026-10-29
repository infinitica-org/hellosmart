'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { sessionClient, type AuthBroadcastMessage } from '@/lib/session-client';

export interface IdleWarningModalProps {
  /** Total idle timeout in seconds (default 900 = 15 minutes) */
  idleTimeoutSeconds?: number;
  /** Warning threshold in seconds before timeout (default 120 = 2 minutes) */
  warningThresholdSeconds?: number;
}

export function IdleWarningModal({
  idleTimeoutSeconds = 900,
  warningThresholdSeconds = 120,
}: IdleWarningModalProps): React.JSX.Element | null {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [isExtending, setIsExtending] = useState<boolean>(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const stayButtonRef = useRef<HTMLButtonElement | null>(null);

  // Formats seconds into MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(Math.max(0, seconds) / 60);
    const secs = Math.max(0, seconds) % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSignOutExpired = useCallback(() => {
    setSecondsRemaining(null);
    sessionClient.signOut('session-expired');
  }, []);

  const handleStaySignedIn = useCallback(async () => {
    setIsExtending(true);
    setExtendError(null);
    const isValid = await sessionClient.extendSession();
    setIsExtending(false);

    if (isValid) {
      lastActivityRef.current = Date.now();
      setSecondsRemaining(null);
    } else {
      setExtendError('Your session has already expired on the server.');
      setTimeout(() => {
        handleSignOutExpired();
      }, 1500);
    }
  }, [handleSignOutExpired]);

  // Record user activity
  const handleUserActivity = useCallback(() => {
    // Only reset if modal is not currently open (if modal is open, user must click Stay Signed In)
    if (secondsRemaining === null) {
      const now = Date.now();
      // Throttle activity pings to at most once every 15 seconds
      if (now - lastActivityRef.current > 15000) {
        lastActivityRef.current = now;
        sessionClient.broadcast({ type: 'ACTIVITY_PING', timestamp: now });
      }
    }
  }, [secondsRemaining]);

  useEffect(() => {
    // Listen for cross-tab sync events
    const unsubscribe = sessionClient.subscribe((msg: AuthBroadcastMessage) => {
      if (msg.type === 'SESSION_EXTENDED' || msg.type === 'ACTIVITY_PING') {
        lastActivityRef.current = msg.timestamp;
        // If modal was shown in this tab, close it because another tab extended the session
        setSecondsRemaining(null);
      }
    });

    // Activity event listeners
    const activityEvents = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Check timer every second
    const interval = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remainingTotal = idleTimeoutSeconds - elapsedSeconds;

      if (remainingTotal <= 0) {
        handleSignOutExpired();
      } else if (remainingTotal <= warningThresholdSeconds) {
        setSecondsRemaining(remainingTotal);
      } else {
        setSecondsRemaining(null);
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [idleTimeoutSeconds, warningThresholdSeconds, handleSignOutExpired, handleUserActivity]);

  // Focus trap / initial focus on modal open
  useEffect(() => {
    if (secondsRemaining !== null && stayButtonRef.current) {
      stayButtonRef.current.focus();
    }
  }, [secondsRemaining !== null]);

  if (secondsRemaining === null) {
    return null;
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-warning-title"
      aria-describedby="idle-warning-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
    >
      <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-6 text-center">
        {/* Warning Icon */}
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-600 text-2xl font-bold"
          aria-hidden="true"
        >
          ⏱
        </div>

        <div className="space-y-2">
          <h2 id="idle-warning-title" className="text-xl font-bold text-slate-900">
            Are you still there?
          </h2>
          <p id="idle-warning-desc" className="text-sm text-slate-600">
            For security, your session will time out due to inactivity in:
          </p>
          <div
            className="text-4xl font-extrabold tracking-tight text-amber-600 font-mono py-2"
            aria-live="polite"
          >
            {formatTime(secondsRemaining)}
          </div>
          {extendError && (
            <p className="text-xs text-rose-600 font-medium" role="alert">
              {extendError}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            ref={stayButtonRef}
            type="button"
            onClick={handleStaySignedIn}
            disabled={isExtending}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
          >
            {isExtending ? 'Verifying...' : 'Stay signed in'}
          </button>
          <button
            type="button"
            onClick={handleSignOutExpired}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
          >
            Sign out now
          </button>
        </div>
      </div>
    </div>
  );
}

