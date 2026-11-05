'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AssessmentTimingResponse } from '@hs/contracts';
import { fetchCandidateTiming } from '@/lib/candidate-api';

export interface UseAssessmentTimingResult {
  remainingMs: number;
  formattedTime: string;
  isWarning: boolean;
  isExpired: boolean;
  deadlineUtc: string | null;
  durationMinutes: number;
  isLoading: boolean;
  error: Error | null;
  syncTiming: () => Promise<void>;
}

function pad(num: number): string {
  return num.toString().padStart(2, '0');
}

export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
}

export function useAssessmentTiming(
  assessmentId: string,
  defaultDurationMinutes = 90
): UseAssessmentTimingResult {
  const initialMs = defaultDurationMinutes * 60 * 1000;
  const [timingData, setTimingData] = useState<AssessmentTimingResponse | null>(null);
  const [remainingMs, setRemainingMs] = useState<number>(initialMs);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const serverOffsetRef = useRef<number>(0);
  const deadlineMsRef = useRef<number>(Date.now() + initialMs);

  const syncTiming = useCallback(async () => {
    try {
      const clientRequestTime = Date.now();
      const data: AssessmentTimingResponse = await fetchCandidateTiming(assessmentId);
      setTimingData(data);

      const serverNowMs = new Date(data.serverTimeUtc).getTime();
      const deadlineMs = new Date(data.deadlineUtc).getTime();
      deadlineMsRef.current = deadlineMs;

      // Calculate clock offset between server UTC and client monotonic clock
      const serverOffset = serverNowMs - clientRequestTime;
      serverOffsetRef.current = serverOffset;

      const syncedNow = Date.now() + serverOffset;
      const initialRemaining = Math.max(0, deadlineMs - syncedNow);
      setRemainingMs(initialRemaining);
      setError(null);
    } catch (err: unknown) {
      const errObj = err instanceof Error ? err : new Error('Timing synchronization error');
      setError(errObj);
    } finally {
      setIsLoading(false);
    }
  }, [assessmentId]);

  // Initial fetch on mount
  useEffect(() => {
    void syncTiming();
  }, [syncTiming]);

  // High-frequency second tick for precise countdown
  useEffect(() => {
    if (!deadlineMsRef.current) return;

    const interval = setInterval(() => {
      const syncedNow = Date.now() + serverOffsetRef.current;
      const currentRemaining = Math.max(0, deadlineMsRef.current - syncedNow);
      setRemainingMs(currentRemaining);

      if (currentRemaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timingData]);

  // Warning state when less than 10 minutes (600,000 ms) remain
  const isWarning = remainingMs > 0 && remainingMs <= 10 * 60 * 1000;
  const isExpired = !isLoading && timingData !== null && remainingMs <= 0;

  return {
    remainingMs,
    formattedTime: formatRemainingTime(remainingMs),
    isWarning,
    isExpired,
    deadlineUtc: timingData?.deadlineUtc ?? null,
    durationMinutes: timingData?.durationMinutes ?? 90,
    isLoading,
    error,
    syncTiming,
  };
}

