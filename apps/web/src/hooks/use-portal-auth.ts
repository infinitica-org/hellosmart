'use client';

import { useCallback, useEffect, useState } from 'react';
import { getMe, type UserMe } from '@/lib/api-client';
import { sessionClient } from '@/lib/session-client';

export function usePortalAuth(): {
  user: UserMe | null;
  loading: boolean;
  signOut: () => Promise<void>;
} {
  const [user, setUser] = useState<UserMe | null>(() => sessionClient.getCurrentUser());
  const [loading, setLoading] = useState(() => sessionClient.getCurrentUser() === null);

  useEffect(() => {
    if (sessionClient.getCurrentUser()) {
      setUser(sessionClient.getCurrentUser());
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const me = await getMe();
        if (!cancelled) {
          setUser(me);
          sessionClient.setCurrentUser(me);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await sessionClient.signOut('user-logout');
  }, []);

  return { user, loading, signOut };
}
