'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseWorkspaceFullscreenResult {
  isFullscreen: boolean;
  hasExitedFullscreen: boolean;
  isSupported: boolean;
  enterFullscreen: () => Promise<void>;
  exitFullscreen: () => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  dismissExitWarning: () => void;
}

export function useWorkspaceFullscreen(): UseWorkspaceFullscreenResult {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [hasExitedFullscreen, setHasExitedFullscreen] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(true);

  const wasFullscreenRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const supported = Boolean(
      document.fullscreenEnabled ||
        (document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled
    );
    setIsSupported(supported);

    const handleFullscreenChange = () => {
      const activeElement = document.fullscreenElement;
      const currentlyFullscreen = Boolean(activeElement);
      setIsFullscreen(currentlyFullscreen);

      // If user was previously in full-screen and just dropped out, trigger advisory state
      if (!currentlyFullscreen && wasFullscreenRef.current) {
        setHasExitedFullscreen(true);
      }

      wasFullscreenRef.current = currentlyFullscreen;
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const enterFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
        setHasExitedFullscreen(false);
        wasFullscreenRef.current = true;
      }
    } catch {
      // Browser may reject if not user gesture or blocked by permissions
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Ignored
    }
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  const dismissExitWarning = useCallback(() => {
    setHasExitedFullscreen(false);
  }, []);

  return {
    isFullscreen,
    hasExitedFullscreen,
    isSupported,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    dismissExitWarning,
  };
}
