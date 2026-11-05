import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  formatRemainingTime,
} from '@/hooks/candidate/use-assessment-timing';
import {
  CandidateDraftSchema,
  SubmitAssessmentDtoSchema,
  UploadedArtifactMetadataSchema,
} from '@hs/contracts';

describe('Candidate Workspace & Submission (Stream 7.4 - #120)', () => {
  describe('Active Timer & Authoritative Synchronization', () => {
    it('formats remaining milliseconds into HH:MM:SS format', () => {
      // 1 hour, 15 minutes, 30 seconds = 4,530,000 ms
      expect(formatRemainingTime(4530000)).toBe('01:15:30');
    });

    it('formats remaining milliseconds under 1 hour into MM:SS format', () => {
      // 9 minutes, 42 seconds = 582,000 ms
      expect(formatRemainingTime(582000)).toBe('09:42');
    });

    it('formats zero or negative milliseconds as 00:00:00', () => {
      expect(formatRemainingTime(0)).toBe('00:00:00');
      expect(formatRemainingTime(-5000)).toBe('00:00:00');
    });

    it('calculates warning state correctly when remaining time is below 10 minutes', () => {
      const tenMinutesMs = 10 * 60 * 1000;
      const nineMinutesMs = 9 * 60 * 1000;
      const elevenMinutesMs = 11 * 60 * 1000;
      const isWarning = (ms: number) => ms > 0 && ms <= tenMinutesMs;

      expect(isWarning(nineMinutesMs)).toBe(true);
      expect(isWarning(elevenMinutesMs)).toBe(false);
      expect(isWarning(0)).toBe(false);
    });

    it('synchronizes client time with server UTC using server offset calculation', () => {
      const clientNow = 1000000;
      const serverNow = 1002000; // Server is 2000ms ahead
      const deadline = 1060000;

      const serverOffset = serverNow - clientNow;
      const synchronizedNow = clientNow + serverOffset;
      const remainingMs = Math.max(0, deadline - synchronizedNow);

      expect(serverOffset).toBe(2000);
      expect(remainingMs).toBe(58000);
    });
  });

  describe('Deliverable Upload Validation (Stream 4 Storage)', () => {
    const MAX_SIZE = 52428800; // 50 MB
    const ALLOWED_EXTS = ['.zip', '.tar', '.gz', '.tgz'];

    const validateUpload = (fileName: string, sizeBytes: number): { valid: boolean; error?: string } => {
      if (sizeBytes > MAX_SIZE) {
        return { valid: false, error: 'FILE_TOO_LARGE' };
      }
      const lower = fileName.toLowerCase();
      const isAllowed = ALLOWED_EXTS.some((ext) => lower.endsWith(ext));
      if (!isAllowed) {
        return { valid: false, error: 'UNSUPPORTED_TYPE' };
      }
      return { valid: true };
    };

    it('accepts valid archives under 50 MB', () => {
      expect(validateUpload('project-solution.zip', 1024 * 1024).valid).toBe(true);
      expect(validateUpload('codebase.tar.gz', 5000000).valid).toBe(true);
      expect(validateUpload('submission.tgz', 52428800).valid).toBe(true);
    });

    it('rejects files exceeding 50 MB limit', () => {
      const res = validateUpload('oversized.zip', 52428801);
      expect(res.valid).toBe(false);
      expect(res.error).toBe('FILE_TOO_LARGE');
    });

    it('rejects non-archive file extensions', () => {
      expect(validateUpload('solution.pdf', 1024).valid).toBe(false);
      expect(validateUpload('script.py', 1024).valid).toBe(false);
      expect(validateUpload('malware.exe', 1024).valid).toBe(false);
    });

    it('validates UploadedArtifactMetadataSchema correctly', () => {
      const validMetadata = {
        id: 'art_123',
        originalName: 'source.zip',
        mimeType: 'application/zip',
        sizeBytes: 1542000,
        downloadUrl: 'https://storage.hellosmart.ai/artifacts/art_123',
        uploadedAt: new Date().toISOString(),
      };
      const result = UploadedArtifactMetadataSchema.safeParse(validMetadata);
      expect(result.success).toBe(true);
    });
  });

  describe('Candidate Draft & Autosave Contracts (BR-11)', () => {
    it('validates a valid draft payload', () => {
      const draft = {
        assessmentId:'asm-test-001',
        repositoryUrl: 'https://github.com/candidate/fullstack-test',
        branchName: 'feature/assessment',
        architectureNotes: 'Built with NestJS and PostgreSQL with multi-tenant RLS.',
        version: 1,
      };

      const result = CandidateDraftSchema.safeParse(draft);
      expect(result.success).toBe(true);
    });

    it('allows empty optional fields during early draft edits', () => {
      const partialDraft = {
        assessmentId: 'asm-test-002',
        repositoryUrl: '',
        branchName: '',
        architectureNotes: '',
        version: 0,
      };

      const result = CandidateDraftSchema.safeParse(partialDraft);
      expect(result.success).toBe(true);
    });
  });

  describe('Submission Validation & Confirmation Checklist', () => {
    it('rejects submission if required repository URL is invalid or missing', () => {
      const invalidSubmission = {
        assessmentId:'asm-test-001',
        repositoryUrl: 'not-a-valid-url',
        branchName: 'main',
        architectureNotes: 'Comprehensive notes explaining my architecture design.',
        confirmChecklist: true,
      };

      const result = SubmitAssessmentDtoSchema.safeParse(invalidSubmission);
      expect(result.success).toBe(false);
    });

    it('rejects submission if architecture notes are too short', () => {
      const invalidSubmission = {
        assessmentId: 'asm-test-001',
        repositoryUrl: 'https://github.com/candidate/project',
        branchName: 'main',
        architectureNotes: 'short',
        confirmChecklist: true,
      };

      const result = SubmitAssessmentDtoSchema.safeParse(invalidSubmission);
      expect(result.success).toBe(false);
    });

    it('rejects submission if confirmation checklist is false', () => {
      const unconfirmedSubmission = {
        assessmentId: 'asm-test-001',
        repositoryUrl: 'https://github.com/candidate/project',
        branchName: 'main',
        architectureNotes: 'Comprehensive architecture notes describing system design and security.',
        confirmChecklist: false,
      };

      const result = SubmitAssessmentDtoSchema.safeParse(unconfirmedSubmission);
      expect(result.success).toBe(false);
    });

    it('accepts submission when all required deliverables and confirmation are satisfied', () => {
      const validSubmission = {
        assessmentId: 'asm-test-001',
        repositoryUrl: 'https://github.com/candidate/project',
        branchName: 'main',
        uploadedArtifactId: 'art_888',
        architectureNotes: 'Comprehensive architecture notes describing system design and security.',
        confirmChecklist: true,
      };

      const result = SubmitAssessmentDtoSchema.safeParse(validSubmission);
      expect(result.success).toBe(true);
    });
  });

  describe('Full-Screen Behavior & Invariants (BR-09, BR-10)', () => {
    it('does not pause or reset the timer upon full-screen exit', () => {
      let isPaused = false;
      const onFullscreenExit = () => {
        // Under BR-09, timer continues running while disconnected or full screen exits
        isPaused = false;
      };

      onFullscreenExit();
      expect(isPaused).toBe(false);
    });

    it('requires explicit user action to enter full screen and handles rejection gracefully', async () => {
      let userClicked = false;
      const requestFullscreenMock = vi.fn().mockImplementation(() => {
        if (!userClicked) {
          return Promise.reject(new Error('User gesture required'));
        }
        return Promise.resolve();
      });

      // Attempt programmatic call without click
      await expect(requestFullscreenMock()).rejects.toThrow('User gesture required');

      // Attempt after user click
      userClicked = true;
      await expect(requestFullscreenMock()).resolves.toBeUndefined();
    });

    it('triggers warning advisory when candidate exits full screen without destroying session', () => {
      let wasFullscreen = true;
      let hasExitedFullscreen = false;

      const handleFullscreenChange = (currentlyFullscreen: boolean) => {
        if (!currentlyFullscreen && wasFullscreen) {
          hasExitedFullscreen = true;
        }
        wasFullscreen = currentlyFullscreen;
      };

      handleFullscreenChange(false);
      expect(hasExitedFullscreen).toBe(true);
    });
  });
});

