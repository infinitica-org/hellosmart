'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { CandidateDraft, UploadedArtifactMetadata } from '@hs/contracts';

export type DraftStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

export interface UseAssessmentDraftResult {
  draft: CandidateDraft;
  status: DraftStatus;
  lastSavedAt: string | null;
  error: Error | null;
  updateDraft: (updates: Partial<Omit<CandidateDraft, 'assessmentId' | 'version'>>) => void;
  flushDraft: () => Promise<boolean>;
  setUploadedArtifact: (artifact: UploadedArtifactMetadata | null) => void;
}

const AUTOSAVE_INTERVAL_MS = 30000; // 30 seconds (BR-11)

export function useAssessmentDraft(assessmentId: string): UseAssessmentDraftResult {
  const [draft, setDraft] = useState<CandidateDraft>({
    assessmentId,
    repositoryUrl: '',
    branchName: 'main',
    uploadedArtifact: null,
    architectureNotes: '',
    version: 0,
  });

  const [status, setStatus] = useState<DraftStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const draftRef = useRef<CandidateDraft>(draft);
  draftRef.current = draft;

  const statusRef = useRef<DraftStatus>(status);
  statusRef.current = status;

  const isSavingRef = useRef<boolean>(false);

  // Load initial draft from server
  useEffect(() => {
    let isCancelled = false;

    async function loadDraft() {
      try {
        const res = await fetch(
          `/api/candidate/assessment/draft?assessmentId=${encodeURIComponent(assessmentId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;

        const data: CandidateDraft = await res.json();
        if (!isCancelled && data) {
          setDraft(data);
          if (data.updatedAt) {
            setLastSavedAt(data.updatedAt);
            setStatus('saved');
          }
        }
      } catch {
        // Silently continue with blank draft if initial fetch fails
      }
    }

    void loadDraft();
    return () => {
      isCancelled = true;
    };
  }, [assessmentId]);

  // Core save function
  const saveToServer = useCallback(async (): Promise<boolean> => {
    if (isSavingRef.current) return false;
    isSavingRef.current = true;
    setStatus('saving');
    setError(null);

    try {
      const currentDraft = draftRef.current;
      const res = await fetch('/api/candidate/assessment/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(currentDraft),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || `Autosave failed (${res.status})`);
      }

      const resJson = await res.json();
      const savedTime = resJson?.updatedAt || new Date().toISOString();
      const nextVersion = resJson?.version || (currentDraft.version || 0) + 1;

      setDraft((prev: CandidateDraft) => ({
        ...prev,
        version: nextVersion,
        updatedAt: savedTime,
      }));
      setLastSavedAt(savedTime);
      setStatus('saved');
      return true;
    } catch (err: unknown) {
      const errObj = err instanceof Error ? err : new Error('Failed to save assessment draft');
      setError(errObj);
      setStatus('error');
      return false;
    } finally {
      isSavingRef.current = false;
    }
  }, []);

  // Update draft in state and mark dirty
  const updateDraft = useCallback(
    (updates: Partial<Omit<CandidateDraft, 'assessmentId' | 'version'>>) => {
      setDraft((prev: CandidateDraft) => ({
        ...prev,
        ...updates,
      }));
      setStatus('dirty');
    },
    []
  );

  const setUploadedArtifact = useCallback(
    (artifact: UploadedArtifactMetadata | null) => {
      updateDraft({ uploadedArtifact: artifact });
    },
    [updateDraft]
  );

  // Autosave interval: every 30 seconds if dirty
  useEffect(() => {
    const timer = setInterval(() => {
      if (statusRef.current === 'dirty' && !isSavingRef.current) {
        void saveToServer();
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [saveToServer]);

  // Re-save on network reconnection if dirty or error
  useEffect(() => {
    const handleOnline = () => {
      if (statusRef.current === 'dirty' || statusRef.current === 'error') {
        void saveToServer();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [saveToServer]);

  // Expose explicit flush for pre-submission guarantee
  const flushDraft = useCallback(async (): Promise<boolean> => {
    if (statusRef.current === 'saved' || statusRef.current === 'idle') {
      return true;
    }
    return saveToServer();
  }, [saveToServer]);

  return {
    draft,
    status,
    lastSavedAt,
    error,
    updateDraft,
    flushDraft,
    setUploadedArtifact,
  };
}
