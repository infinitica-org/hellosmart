'use client';

import React, { useEffect } from 'react';
import { ToastProvider, useToast } from '@hs/ui';
import { registerRateLimitHandler } from '@/store/api/baseApi';

/**
 * Headless consumer component that connects the centralized RTK Query rate-limit notification
 * handler to the existing @hs/ui toast system.
 * When any RTK Query endpoint encounters an HTTP 429, this consumer immediately displays
 * a user-friendly warning toast.
 */
export function RateLimitToastConsumer(): null {
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = registerRateLimitHandler((message) => {
      toast.warning('Rate Limit Exceeded', message);
    });
    return unsubscribe;
  }, [toast]);

  return null;
}

export interface AppToastProviderProps {
  children: React.ReactNode;
}

/**
 * Root toast provider wrapping the existing @hs/ui ToastProvider with
 * automatic rate-limit toast notifications.
 */
export function AppToastProvider({ children }: AppToastProviderProps): React.JSX.Element {
  return (
    <ToastProvider position="bottom-right">
      <RateLimitToastConsumer />
      {children}
    </ToastProvider>
  );
}

