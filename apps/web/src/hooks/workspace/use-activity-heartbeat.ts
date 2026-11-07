'use client';

import { useEffect, useRef, useCallback } from 'react';

export interface UseActivityHeartbeatOptions {
  workspaceId: string;
  intervalMs?: number;
  enabled?: boolean;
  onSessionEnded?: (status: string) => void;
}

export interface ActivityHeartbeatState {
  lastHeartbeatAt: number | null;
  serverTimeUtc: string | null;
  workspaceStatus: string | null;
  remainingMs: number | null;
}

export const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;

export interface HeartbeatPingResult {
  ok: boolean;
  status: number;
  data?: any;
  isTerminal?: boolean;
  terminalReason?: string;
}

/**
 * Executes a single workspace heartbeat request to the Next.js BFF proxy.
 */
export async function executeHeartbeatPing(
  workspaceId: string,
  signal?: AbortSignal,
): Promise<HeartbeatPingResult> {
  const fetchInit: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (signal) {
    fetchInit.signal = signal;
  }

  const res = await fetch(
    `/api/candidate/workspace/${encodeURIComponent(workspaceId)}/heartbeat`,
    fetchInit,
  );

  const data = await res.json().catch(() => null);

  if (res.status === 409 || res.status === 410) {
    return {
      ok: false,
      status: res.status,
      data,
      isTerminal: true,
      terminalReason: data?.code || (res.status === 409 ? 'submitted' : 'expired'),
    };
  }

  const assignmentStatus = data?.assignmentStatus;
  if (
    assignmentStatus === 'submitted' ||
    assignmentStatus === 'expired' ||
    assignmentStatus === 'revoked'
  ) {
    return {
      ok: res.ok,
      status: res.status,
      data,
      isTerminal: true,
      terminalReason: assignmentStatus,
    };
  }

  return {
    ok: res.ok,
    status: res.status,
    data,
    isTerminal: false,
  };
}

/**
 * Hook for workspace activity tracking heartbeat (I174, BR-08, BR-11).
 * Periodically posts heartbeats to the BFF route to refresh last_activity_at,
 * verify session validity, and detect expired/submitted terminal states.
 */
export function useActivityHeartbeat({
  workspaceId,
  intervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
  enabled = true,
  onSessionEnded,
}: UseActivityHeartbeatOptions) {
  const isSendingRef = useRef(false);
  const isStoppedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const onSessionEndedRef = useRef(onSessionEnded);

  // Keep callback ref updated to avoid stale closures
  useEffect(() => {
    onSessionEndedRef.current = onSessionEnded;
  }, [onSessionEnded]);

  // Reset stopped flag when workspaceId changes
  useEffect(() => {
    isStoppedRef.current = false;
  }, [workspaceId]);

  const sendHeartbeat = useCallback(async () => {
    if (!workspaceId || !enabled || isSendingRef.current || isStoppedRef.current) {
      return;
    }

    // Do not ping when document is hidden (respect candidate idle/backgrounding)
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    isSendingRef.current = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await executeHeartbeatPing(workspaceId, controller.signal);

      if (result.isTerminal) {
        isStoppedRef.current = true;
        onSessionEndedRef.current?.(result.terminalReason || 'ended');
        return;
      }

      if (!result.ok) {
        console.warn(`[WorkspaceHeartbeat] Upstream returned status ${result.status}`);
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        return;
      }
      console.warn('[WorkspaceHeartbeat] Heartbeat ping failed:', err);
    } finally {
      isSendingRef.current = false;
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [workspaceId, enabled]);

  useEffect(() => {
    if (!enabled || !workspaceId || isStoppedRef.current) {
      return;
    }

    // Fire initial heartbeat on mount / activation
    void sendHeartbeat();

    // Setup periodic interval
    const intervalTimer = setInterval(() => {
      void sendHeartbeat();
    }, intervalMs);

    // Setup visibility change listener (BR-11)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isStoppedRef.current) {
        void sendHeartbeat();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [enabled, workspaceId, intervalMs, sendHeartbeat]);

  return {
    isSending: isSendingRef.current,
    isStopped: isStoppedRef.current,
  };
}
