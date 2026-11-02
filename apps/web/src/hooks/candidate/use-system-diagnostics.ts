'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export type DiagnosticStatus = 'pass' | 'warning' | 'error' | 'pending';

export interface ResolutionCheckResult {
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  minWidth: number;
  minHeight: number;
  status: DiagnosticStatus;
  message: string;
}

export interface BrowserCheckResult {
  browserName: string;
  browserVersion: string;
  isSupported: boolean;
  hasFullscreen: boolean;
  hasWebSockets: boolean;
  hasLocalStorage: boolean;
  status: DiagnosticStatus;
  message: string;
}

export interface NetworkCheckResult {
  latencyMs: number | null;
  samples: number[];
  endpoint: string;
  status: DiagnosticStatus;
  message: string;
  lastChecked: string | null;
}

export interface SystemDiagnosticsState {
  isRunning: boolean;
  isComplete: boolean;
  resolution: ResolutionCheckResult;
  browser: BrowserCheckResult;
  network: NetworkCheckResult;
  overallStatus: 'idle' | 'running' | 'ready' | 'warning' | 'error';
  canProceed: boolean;
}

export const MIN_SCREEN_WIDTH = 1280;
export const MIN_SCREEN_HEIGHT = 720;
export const LATENCY_EXCELLENT_MS = 150;
export const LATENCY_MAX_ACCEPTABLE_MS = 300;

export function detectBrowserInfo(userAgent: string): { name: string; version: string; isSupported: boolean } {
  const ua = userAgent || '';

  // Edge (Chromium-based)
  if (ua.includes('Edg/')) {
    const match = ua.match(/Edg\/([0-9.]+)/);
    return { name: 'Microsoft Edge', version: match ? match[1]! : '', isSupported: true };
  }

  // Opera (Chromium-based)
  if (ua.includes('OPR/') || ua.includes('Opera/')) {
    const match = ua.match(/(?:OPR|Opera)\/([0-9.]+)/);
    return { name: 'Opera', version: match ? match[1]! : '', isSupported: false };
  }

  // Chrome
  if (ua.includes('Chrome/') && !ua.includes('Edg/') && !ua.includes('OPR/')) {
    const match = ua.match(/Chrome\/([0-9.]+)/);
    return { name: 'Google Chrome', version: match ? match[1]! : '', isSupported: true };
  }

  // Firefox
  if (ua.includes('Firefox/')) {
    const match = ua.match(/Firefox\/([0-9.]+)/);
    return { name: 'Mozilla Firefox', version: match ? match[1]! : '', isSupported: true };
  }

  // Safari (AppleWebKit without Chrome)
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) {
    const match = ua.match(/Version\/([0-9.]+)/);
    return { name: 'Apple Safari', version: match ? match[1]! : '', isSupported: true };
  }

  // Opera
  if (ua.includes('OPR/') || ua.includes('Opera/')) {
    const match = ua.match(/(?:OPR|Opera)\/([0-9.]+)/);
    return { name: 'Opera', version: match ? match[1]! : '', isSupported: false };
  }

  return { name: 'Unknown Browser', version: '', isSupported: false };
}

export function evaluateResolution(
  screenWidth: number,
  screenHeight: number,
  viewportWidth: number,
  viewportHeight: number
): ResolutionCheckResult {
  const isSupported = screenWidth >= MIN_SCREEN_WIDTH && screenHeight >= MIN_SCREEN_HEIGHT;

  return {
    screenWidth,
    screenHeight,
    viewportWidth,
    viewportHeight,
    minWidth: MIN_SCREEN_WIDTH,
    minHeight: MIN_SCREEN_HEIGHT,
    status: isSupported ? 'pass' : 'warning',
    message: isSupported
      ? `Meets minimum ${MIN_SCREEN_WIDTH} × ${MIN_SCREEN_HEIGHT} requirement.`
      : `Screen resolution (${screenWidth} × ${screenHeight}) is below the recommended ${MIN_SCREEN_WIDTH} × ${MIN_SCREEN_HEIGHT}. You may need to scroll during tasks.`,
  };
}

export function evaluateBrowser(userAgent: string): BrowserCheckResult {
  const info = detectBrowserInfo(userAgent);
  const hasFullscreen = typeof document !== 'undefined' && 'requestFullscreen' in document.documentElement;
  const hasWebSockets = typeof window !== 'undefined' && 'WebSocket' in window;
  let hasLocalStorage = false;
  try {
    hasLocalStorage = typeof window !== 'undefined' && 'localStorage' in window;
  } catch {
    hasLocalStorage = false;
  }

  return {
    browserName: info.name,
    browserVersion: info.version,
    isSupported: info.isSupported,
    hasFullscreen,
    hasWebSockets,
    hasLocalStorage,
    status: info.isSupported ? 'pass' : 'warning',
    message: info.isSupported
      ? `${info.name} ${info.version ? `v${info.version}` : ''} is fully supported.`
      : `${info.name} is not officially supported. We recommend Google Chrome, Firefox, Safari, or Microsoft Edge.`,
  };
}

export function useSystemDiagnostics(autoRun = true) {
  const [state, setState] = useState<SystemDiagnosticsState>(() => ({
    isRunning: false,
    isComplete: false,
    resolution: {
      screenWidth: 0,
      screenHeight: 0,
      viewportWidth: 0,
      viewportHeight: 0,
      minWidth: MIN_SCREEN_WIDTH,
      minHeight: MIN_SCREEN_HEIGHT,
      status: 'pending',
      message: 'Checking display dimensions...',
    },
    browser: {
      browserName: 'Checking...',
      browserVersion: '',
      isSupported: false,
      hasFullscreen: true,
      hasWebSockets: true,
      hasLocalStorage: true,
      status: 'pending',
      message: 'Checking browser capabilities...',
    },
    network: {
      latencyMs: null,
      samples: [],
      endpoint: '/api/candidate/ping',
      status: 'pending',
      message: 'Measuring network latency to platform API...',
      lastChecked: null,
    },
    overallStatus: 'idle',
    canProceed: false,
  }));

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const measurePing = async (endpoint: string): Promise<number> => {
    const startTime = performance.now();
    const res = await fetch(`${endpoint}?t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const duration = performance.now() - startTime;
    return Math.round(duration);
  };

  const runDiagnostics = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      isRunning: true,
      isComplete: false,
      overallStatus: 'running',
    }));

    // 1. Check Resolution
    const sWidth = typeof window !== 'undefined' ? window.screen.width : 1920;
    const sHeight = typeof window !== 'undefined' ? window.screen.height : 1080;
    const vWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const vHeight = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const resolutionRes = evaluateResolution(sWidth, sHeight, vWidth, vHeight);

    // 2. Check Browser
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const browserRes = evaluateBrowser(ua);

    // 3. Measure Network Latency (3 samples)
    const samples: number[] = [];
    let networkStatus: DiagnosticStatus = 'pending';
    let networkMsg = '';
    let avgLatency: number | null = null;
    const endpoint = '/api/candidate/ping';

    try {
      for (let i = 0; i < 3; i++) {
        const ms = await measurePing(endpoint);
        samples.push(ms);
        // Small interval between samples
        if (i < 2) await new Promise((r) => setTimeout(r, 60));
      }

      avgLatency = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);

      if (avgLatency <= LATENCY_EXCELLENT_MS) {
        networkStatus = 'pass';
        networkMsg = `Optimal connection (${avgLatency} ms latency).`;
      } else if (avgLatency <= LATENCY_MAX_ACCEPTABLE_MS) {
        networkStatus = 'pass';
        networkMsg = `Acceptable connection (${avgLatency} ms latency).`;
      } else {
        networkStatus = 'warning';
        networkMsg = `High latency detected (${avgLatency} ms). You may notice slight delay in remote commands.`;
      }
    } catch {
      networkStatus = 'error';
      networkMsg = 'Network test failed. Unable to reach platform servers. Check your internet connection.';
    }

    if (!isMountedRef.current) return;

    const networkRes: NetworkCheckResult = {
      latencyMs: avgLatency,
      samples,
      endpoint: 'Platform API',
      status: networkStatus,
      message: networkMsg,
      lastChecked: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };

    // Calculate Overall Status
    let overall: 'ready' | 'warning' | 'error' = 'ready';
    if (networkStatus === 'error') {
      overall = 'error';
    } else if (resolutionRes.status === 'warning' || browserRes.status === 'warning' || networkRes.status === 'warning') {
      overall = 'warning';
    }

    setState({
      isRunning: false,
      isComplete: true,
      resolution: resolutionRes,
      browser: browserRes,
      network: networkRes,
      overallStatus: overall,
      canProceed: overall !== 'error',
    });
  }, []);

  useEffect(() => {
    if (autoRun) {
      void runDiagnostics();
    }
  }, [autoRun, runDiagnostics]);

  return {
    ...state,
    runDiagnostics,
  };
}
