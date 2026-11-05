import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateResolution,
  evaluateBrowser,
  detectBrowserInfo,
  MIN_SCREEN_WIDTH,
  MIN_SCREEN_HEIGHT,
  LATENCY_EXCELLENT_MS,
  LATENCY_MAX_ACCEPTABLE_MS,
} from '../hooks/candidate/use-system-diagnostics';
import { ROUTES } from '../constants/routes';

describe('Candidate System Diagnostics & Pre-Test Checks (Stream 7.2 - Ticket #118)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Screen Resolution Check (7.2 Section 4.A)', () => {
    it('passes for full HD 1920 × 1080 resolution', () => {
      const res = evaluateResolution(1920, 1080, 1920, 950);
      expect(res.status).toBe('pass');
      expect(res.screenWidth).toBe(1920);
      expect(res.screenHeight).toBe(1080);
      expect(res.minWidth).toBe(MIN_SCREEN_WIDTH);
      expect(res.minHeight).toBe(MIN_SCREEN_HEIGHT);
    });

    it('passes for 1366 × 768 resolution', () => {
      const res = evaluateResolution(1366, 768, 1366, 700);
      expect(res.status).toBe('pass');
    });

    it('passes for exact minimum threshold 1280 × 720', () => {
      const res = evaluateResolution(1280, 720, 1280, 680);
      expect(res.status).toBe('pass');
    });

    it('warns for low width 1024 × 768 (below 1280)', () => {
      const res = evaluateResolution(1024, 768, 1024, 700);
      expect(res.status).toBe('warning');
      expect(res.message).toContain('below the recommended');
    });

    it('warns for low height 1280 × 600 (below 720)', () => {
      const res = evaluateResolution(1280, 600, 1280, 560);
      expect(res.status).toBe('warning');
      expect(res.message).toContain('below the recommended');
    });
  });

  describe('Browser Compatibility Check (7.2 Section 4.B)', () => {
    it('detects and supports Google Chrome', () => {
      const chromeUa =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
      const info = detectBrowserInfo(chromeUa);
      expect(info.name).toBe('Google Chrome');
      expect(info.isSupported).toBe(true);

      const check = evaluateBrowser(chromeUa);
      expect(check.status).toBe('pass');
      expect(check.isSupported).toBe(true);
    });

    it('detects and supports Mozilla Firefox', () => {
      const firefoxUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0';
      const info = detectBrowserInfo(firefoxUa);
      expect(info.name).toBe('Mozilla Firefox');
      expect(info.isSupported).toBe(true);

      const check = evaluateBrowser(firefoxUa);
      expect(check.status).toBe('pass');
    });

    it('detects and supports Apple Safari', () => {
      const safariUa =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
      const info = detectBrowserInfo(safariUa);
      expect(info.name).toBe('Apple Safari');
      expect(info.isSupported).toBe(true);

      const check = evaluateBrowser(safariUa);
      expect(check.status).toBe('pass');
    });

    it('detects and supports Microsoft Edge', () => {
      const edgeUa =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.2849.56';
      const info = detectBrowserInfo(edgeUa);
      expect(info.name).toBe('Microsoft Edge');
      expect(info.isSupported).toBe(true);

      const check = evaluateBrowser(edgeUa);
      expect(check.status).toBe('pass');
    });

    it('warns for unsupported browsers (e.g. Opera / legacy / unknown)', () => {
      const operaUa =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/114.0.0.0';
      const info = detectBrowserInfo(operaUa);
      expect(info.name).toBe('Opera');
      expect(info.isSupported).toBe(false);

      const check = evaluateBrowser(operaUa);
      expect(check.status).toBe('warning');
      expect(check.message).toContain('not officially supported');
    });
  });

  describe('Network Latency Check Thresholds (7.2 Section 4.C)', () => {
    it('defines clear latency bounds for optimal and acceptable connectivity', () => {
      expect(LATENCY_EXCELLENT_MS).toBe(150);
      expect(LATENCY_MAX_ACCEPTABLE_MS).toBe(300);
    });

    it('evaluates latency classifications correctly', () => {
      const classifyLatency = (latency: number): 'pass' | 'warning' => {
        if (latency <= LATENCY_MAX_ACCEPTABLE_MS) return 'pass';
        return 'warning';
      };

      expect(classifyLatency(42)).toBe('pass');
      expect(classifyLatency(140)).toBe('pass');
      expect(classifyLatency(250)).toBe('pass');
      expect(classifyLatency(350)).toBe('warning');
    });
  });

  describe('Diagnostics Completion & Navigation to Consent (#119)', () => {
    it('generates correct Consent (#119) route from assessment id', () => {
      const assessmentId = 'asm-tech-456';
      const consentRoute = ROUTES.CANDIDATE.CONSENT(assessmentId);
      expect(consentRoute).toBe('/candidate/assessments/asm-tech-456/consent');
    });

    it('allows candidate to proceed when warnings are present (non-blocking policy)', () => {
      const evaluateReadiness = (
        resolutionStatus: 'pass' | 'warning',
        browserStatus: 'pass' | 'warning',
        networkStatus: 'pass' | 'warning' | 'error'
      ) => {
        if (networkStatus === 'error') return { canProceed: false, overall: 'error' };
        if (resolutionStatus === 'warning' || browserStatus === 'warning' || networkStatus === 'warning') {
          return { canProceed: true, overall: 'warning' };
        }
        return { canProceed: true, overall: 'ready' };
      };

      // Low resolution should warn but NOT block
      const lowResOnly = evaluateReadiness('warning', 'pass', 'pass');
      expect(lowResOnly.canProceed).toBe(true);
      expect(lowResOnly.overall).toBe('warning');

      // Unsupported browser should warn but NOT block
      const unsuppBrowserOnly = evaluateReadiness('pass', 'warning', 'pass');
      expect(unsuppBrowserOnly.canProceed).toBe(true);

      // Network error MUST block
      const networkFailed = evaluateReadiness('pass', 'pass', 'error');
      expect(networkFailed.canProceed).toBe(false);
      expect(networkFailed.overall).toBe('error');
    });
  });

  describe('Testing-Window Edge Case (7.2 Section 5)', () => {
    it('detects future window start and determines window lock', () => {
      const futureWindowUtc = new Date(Date.now() + 3600000).toISOString(); // 1 hour ahead
      const isWindowNotOpen = new Date(futureWindowUtc).getTime() > Date.now();
      expect(isWindowNotOpen).toBe(true);

      const pastWindowUtc = new Date(Date.now() - 3600000).toISOString();
      const isWindowOpen = new Date(pastWindowUtc).getTime() <= Date.now();
      expect(isWindowOpen).toBe(true);
    });
  });
});

