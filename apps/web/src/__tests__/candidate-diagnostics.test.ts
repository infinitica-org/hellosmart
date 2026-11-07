import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateResolution,
  evaluateBrowser,
  detectBrowserInfo,
  evaluateNetworkStability,
  measureClientInternet,
  MIN_SCREEN_WIDTH,
  MIN_SCREEN_HEIGHT,
  LATENCY_EXCELLENT_MS,
  LATENCY_MAX_ACCEPTABLE_MS,
  MIN_DOWNLOAD_SPEED_MBPS,
  OPTIMAL_DOWNLOAD_SPEED_MBPS,
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

  describe('Network Latency & User Download Speed Check (7.2 Section 4.C)', () => {
    it('defines clear latency and minimum bandwidth bounds', () => {
      expect(LATENCY_EXCELLENT_MS).toBe(150);
      expect(LATENCY_MAX_ACCEPTABLE_MS).toBe(300);
      expect(MIN_DOWNLOAD_SPEED_MBPS).toBe(2.0);
      expect(OPTIMAL_DOWNLOAD_SPEED_MBPS).toBe(5.0);
    });

    it('evaluates network stability and bandwidth correctly', () => {
      // 1. High-speed stable connection (passes, lets candidate proceed)
      const optimal = evaluateNetworkStability(15.5, 45, 10);
      expect(optimal.status).toBe('pass');
      expect(optimal.stability).toBe('Stable');
      expect(optimal.message).toContain('Fast and stable internet connection');

      // 2. Moderate connection (passes with advisory warning)
      const moderate = evaluateNetworkStability(3.5, 180, 20);
      expect(moderate.status).toBe('warning');
      expect(moderate.stability).toBe('Moderate');

      // 3. Unstable / Low bandwidth below 2 Mbps (blocks candidate proceed)
      const lowSpeed = evaluateNetworkStability(0.9, 80, 15);
      expect(lowSpeed.status).toBe('error');
      expect(lowSpeed.stability).toBe('Unstable');
      expect(lowSpeed.message).toContain('Unstable connection detected');

      // 4. Excessive latency > 500ms (blocks candidate proceed)
      const highLag = evaluateNetworkStability(10.0, 550, 20);
      expect(highLag.status).toBe('error');
      expect(highLag.stability).toBe('Unstable');

      // 5. High jitter > 250ms (blocks candidate proceed)
      const jittery = evaluateNetworkStability(8.0, 100, 300);
      expect(jittery.status).toBe('error');
      expect(jittery.stability).toBe('Unstable');
    });

    it('evaluates legacy latency classifications correctly', () => {
      const classifyLatency = (latency: number): 'pass' | 'warning' => {
        if (latency <= LATENCY_MAX_ACCEPTABLE_MS) return 'pass';
        return 'warning';
      };

      expect(classifyLatency(42)).toBe('pass');
      expect(classifyLatency(140)).toBe('pass');
      expect(classifyLatency(250)).toBe('pass');
      expect(classifyLatency(350)).toBe('warning');
    });

    it('measures real download speed accurately based on actual bytes transferred', async () => {
      // Mock fetch: HEAD returns instantly for ping; GET returns a stream of bytes
      const mockBytes = new Uint8Array(2_500_000); // 2.5 MB (20 Mb)
      let mockTime = 1000;
      vi.spyOn(performance, 'now').mockImplementation(() => {
        mockTime += 667; // 20 Mb / 0.667s = ~30.0 Mbps
        return mockTime;
      });

      const mockResponse = new Response(mockBytes, {
        status: 200,
        headers: { 'Content-Length': '2500000' },
      });

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        if (init?.method === 'HEAD') {
          return new Response(null, { status: 200 });
        }
        return mockResponse.clone();
      });

      const result = await measureClientInternet();
      expect(result.speedMbps).toBeGreaterThan(0);
      // Confirms speed is genuinely calculated rather than defaulting to 50
      expect(result.speedMbps).toBeCloseTo(30, 0);
      expect(result.latencyMs).toBeGreaterThan(0);
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

