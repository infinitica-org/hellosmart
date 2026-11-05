import { registerUnauthorizedHandler, type ApiErrorPayload } from './api/baseApi';
import { sessionClient } from '@/lib/session-client';

/**
 * ============================================================================
 * AUTHENTICATION INTEGRATION & 401 EXPIRATION (S1-T00-4, BR-24, BR-25)
 * ============================================================================
 * Connects centralized RTK Query 401 unauthorized notifications to the
 * session lifecycle manager.
 *
 * When an RTK Query endpoint returns 401 Unauthorized:
 * 1. The active store's RTK Query cache is purged immediately by notifyUnauthorized.
 * 2. Concurrent 401s are deduplicated (3000ms window).
 * 3. In-memory user state is cleared.
 * 4. sessionClient.signOut('session-expired') is invoked:
 *    - Calls logout BFF route
 *    - Notifies local store providers to purge root store state
 *    - Broadcasts LOGOUT event to other open tabs via BroadcastChannel
 *    - Safely redirects browser to /login?reason=session-expired
 *
 * Note: HTTP 403 Forbidden is NOT handled here; 403 represents permission
 * denial within an active session and must be returned directly to calling components.
 * ============================================================================
 */

let unregisterHandler: (() => void) | null = null;
let activeProviderCount = 0;

/**
 * Initializes the auth integration listener.
 * Reference-counted so multiple active providers can register safely.
 */
export function initAuthIntegration(): () => void {
  activeProviderCount++;

  if (!unregisterHandler) {
    unregisterHandler = registerUnauthorizedHandler((_error: ApiErrorPayload, _api) => {
      // Clear in-memory current user
      sessionClient.setCurrentUser(null);
      // Trigger session expiration lifecycle
      void sessionClient.signOut('session-expired');
    });
  }

  return () => {
    activeProviderCount--;
    if (activeProviderCount <= 0 && unregisterHandler) {
      unregisterHandler();
      unregisterHandler = null;
      activeProviderCount = 0;
    }
  };
}

/**
 * Returns current count of registered active providers (for test verification).
 */
export function getActiveProviderCount(): number {
  return activeProviderCount;
}

/**
 * Explicit reset helper for testing.
 */
export function resetAuthIntegration(): void {
  if (unregisterHandler) {
    unregisterHandler();
    unregisterHandler = null;
  }
  activeProviderCount = 0;
}

