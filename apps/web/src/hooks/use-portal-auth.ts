'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMe, type UserMe } from '@/lib/api-client';
import {
  sessionClient,
  isSafeRedirectPath,
  type AuthBroadcastMessage,
} from '@/lib/session-client';

export type SessionStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'error';

export interface UsePortalAuthOptions {
  requiredRole?: 'platform_admin' | 'company_admin' | 'candidate';
  redirectTo?: string;
  autoRedirect?: boolean;
}

export interface UsePortalAuthReturn {
  user: UserMe | null;
  loading: boolean;
  status: SessionStatus;
  isAuthorized: boolean;
  error: Error | null;
  signOut: () => Promise<void>;
  refresh: () => Promise<UserMe | null>;
}

// In-flight request deduplication across concurrent component mounts / React StrictMode
let pendingMePromise: Promise<UserMe | null> | null = null;

export async function fetchAuthenticatedSession(force = false): Promise<UserMe | null> {
  if (!force) {
    const existing = sessionClient.getCurrentUser();
    if (existing) {
      return existing;
    }
  }

  if (pendingMePromise) {
    return pendingMePromise;
  }

  pendingMePromise = (async () => {
    try {
      const me = await getMe();
      sessionClient.setCurrentUser(me);
      return me;
    } catch (err: any) {
      if (err?.status === 401 || err?.statusCode === 401) {
        sessionClient.setCurrentUser(null);
        return null;
      }
      throw err;
    } finally {
      pendingMePromise = null;
    }
  })();

  return pendingMePromise;
}

export function resetSessionHydrationPromise(): void {
  pendingMePromise = null;
}

export function usePortalAuth(options?: UsePortalAuthOptions): UsePortalAuthReturn {
  const requiredRole = options?.requiredRole;
  const autoRedirect = options?.autoRedirect ?? true;

  const [user, setUser] = useState<UserMe | null>(() => sessionClient.getCurrentUser());
  const [status, setStatus] = useState<SessionStatus>(() =>
    sessionClient.getCurrentUser() ? 'authenticated' : 'idle',
  );
  const [error, setError] = useState<Error | null>(null);

  const loading = status === 'idle' || status === 'loading';
  const isAuthorized =
    status === 'authenticated' &&
    user !== null &&
    (requiredRole ? user.role === requiredRole : true);

  const hydrateSession = useCallback(async (force = false) => {
    setStatus('loading');
    try {
      const me = await fetchAuthenticatedSession(force);
      if (me) {
        setUser(me);
        setStatus('authenticated');
        setError(null);
        return me;
      } else {
        setUser(null);
        setStatus('unauthenticated');
        setError(null);
        return null;
      }
    } catch (err: any) {
      setUser(null);
      setStatus('error');
      const normalizedErr = err instanceof Error ? err : new Error(String(err));
      setError(normalizedErr);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // If session already resolved in sessionClient
    const existingUser = sessionClient.getCurrentUser();
    if (existingUser) {
      setUser(existingUser);
      setStatus('authenticated');
    } else {
      void hydrateSession().then((res) => {
        if (cancelled) return;
        // State is updated inside hydrateSession
      });
    }

    // Subscribe to multi-tab auth broadcasts
    const unsubscribe = sessionClient.subscribe((event: AuthBroadcastMessage) => {
      if (cancelled) return;
      if (event.type === 'LOGOUT') {
        setUser(null);
        setStatus('unauthenticated');
      } else if (event.type === 'LOGIN') {
        void hydrateSession(true);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [hydrateSession]);

  // Handle automatic role validation redirect
  useEffect(() => {
    if (!autoRedirect || loading) {
      return;
    }

    if (status === 'unauthenticated' && requiredRole) {
      if (typeof window !== 'undefined') {
        const from = window.location.pathname;
        const target =
          options?.redirectTo ??
          `/login${
            isSafeRedirectPath(from) && from !== '/' && !from.startsWith('/login')
              ? `?from=${encodeURIComponent(from)}`
              : ''
          }`;
        try {
          window.location.href = target;
        } catch {
          // safe in test runners
        }
      }
      return;
    }

    if (status === 'authenticated' && user && requiredRole && user.role !== requiredRole) {
      // Role mismatch: redirect to the user's correct assigned portal
      if (typeof window !== 'undefined') {
        let target = '/login';
        if (user.role === 'platform_admin') target = '/admin';
        else if (user.role === 'company_admin') target = '/company';
        else if (user.role === 'candidate') target = '/candidate';

        try {
          window.location.href = target;
        } catch {
          // safe in test runners
        }
      }
    }
  }, [autoRedirect, loading, status, user, requiredRole, options?.redirectTo]);

  const signOut = useCallback(async () => {
    await sessionClient.signOut('user-logout');
  }, []);

  const refresh = useCallback(async () => {
    return await hydrateSession(true);
  }, [hydrateSession]);

  return {
    user,
    loading,
    status,
    isAuthorized,
    error,
    signOut,
    refresh,
  };
}
