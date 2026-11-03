/**
 * Auth Middleware for RTK Stores (S1-T00-4)
 * Handles store session persistence, 401 unauthorized interception, and session hydration.
 */
export {
  initAuthIntegration,
  getActiveProviderCount,
  resetAuthIntegration,
} from '../authIntegration';
