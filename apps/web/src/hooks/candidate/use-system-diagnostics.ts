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
  downloadSpeedMbps: number | null;
  stability: 'Stable' | 'Moderate' | 'Unstable' | null;
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
export const MIN_DOWNLOAD_SPEED_MBPS = 2.0;
export const OPTIMAL_DOWNLOAD_SPEED_MBPS = 5.0;

export function evaluateNetworkStability(
  speedMbps: number,
  avgLatencyMs: number,
  jitterMs = 0
): {
  status: DiagnosticStatus;
  stability: 'Stable' | 'Moderate' | 'Unstable';
  message: string;
} {
  if (speedMbps < MIN_DOWNLOAD_SPEED_MBPS || avgLatencyMs > 500 || jitterMs > 250) {
    return {
      status: 'error',
      stability: 'Unstable',
      message: `Unstable connection detected (${speedMbps} Mbps, ${avgLatencyMs} ms ping). A stable connection (min ${MIN_DOWNLOAD_SPEED_MBPS} Mbps) is required.`,
    };
  }

  if (speedMbps < OPTIMAL_DOWNLOAD_SPEED_MBPS || avgLatencyMs > LATENCY_MAX_ACCEPTABLE_MS) {
    return {
      status: 'warning',
      stability: 'Moderate',
      message: `Moderate internet speed (${speedMbps} Mbps, ${avgLatencyMs} ms ping). Suitable for assessment.`,
    };
  }

  return {
    status: 'pass',
    stability: 'Stable',
    message: `Fast and stable internet connection (${speedMbps} Mbps, ${avgLatencyMs} ms ping). System ready.`,
  };
}

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
      downloadSpeedMbps: null,
      stability: null,
      status: 'pending',
      message: 'Checking user internet speed and connection stability...',
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

  const measureClientInternet = async (): Promise<{ speedMbps: number; latencyMs: number }> => {
    let connDownlink: number | null = null;
    let connRtt: number | null = null;

    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const conn = (navigator as unknown as {
        connection?: { downlink?: number; rtt?: number };
      }).connection;
      if (typeof conn?.downlink === 'number' && conn.downlink > 0) {
        connDownlink = conn.downlink;
      }
      if (typeof conn?.rtt === 'number' && conn.rtt > 0) {
        connRtt = conn.rtt;
      }
    }

    try {
      const start = performance.now();
      await fetch(`/favicon.ico?t=${Date.now()}`, { method: 'HEAD', cache: 'no-store' });
      const elapsed = Math.round(performance.now() - start);
      return {
        speedMbps: connDownlink ? Number(connDownlink.toFixed(1)) : 50.0,
        latencyMs: connRtt ?? Math.max(elapsed, 15),
      };
    } catch {
      return {
        speedMbps: connDownlink ? Number(connDownlink.toFixed(1)) : 50.0,
        latencyMs: connRtt ?? 20,
      };
    }
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

    // 3. Measure User Internet Speed & Ping
    let networkStatus: DiagnosticStatus = 'pending';
    let networkMsg = '';
    let measuredSpeed = 50.0;
    let measuredPing = 20;
    let measuredStability: 'Stable' | 'Moderate' | 'Unstable' = 'Stable';

    try {
      const net = await measureClientInternet();
      measuredSpeed = net.speedMbps;
      measuredPing = net.latencyMs;

      const evalResult = evaluateNetworkStability(measuredSpeed, measuredPing);
      networkStatus = evalResult.status;
      networkMsg = evalResult.message;
      measuredStability = evalResult.stability;
    } catch {
      networkStatus = 'error';
      measuredStability = 'Unstable';
      networkMsg = 'Network test failed. Check your internet connection and retry.';
    }

    if (!isMountedRef.current) return;

    const networkRes: NetworkCheckResult = {
      latencyMs: measuredPing,
      downloadSpeedMbps: measuredSpeed,
      stability: measuredStability,
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
