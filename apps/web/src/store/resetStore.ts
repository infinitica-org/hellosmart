import { createAction } from '@reduxjs/toolkit';
import { adminApi } from './admin/adminApi';
import { companyApi } from './company/companyApi';
import { candidateApi } from './candidate/candidateApi';
import type { AdminStore } from './admin/adminStore';
import type { CompanyStore } from './company/companyStore';
import type { CandidateStore } from './candidate/candidateStore';

/**
 * ============================================================================
 * ZERO-PERSISTENCE & STORE PURGE POLICY (S1-T00-4, BR-24, BR-25)
 * ============================================================================
 * 1. Strict In-Memory Lifetime: All Redux Toolkit stores (Admin, Company,
 *    Candidate) are strictly ephemeral, in-memory state containers.
 * 2. Zero Browser Storage Persistence: RTK Query caches, normalized entities,
 *    and user credentials must NEVER be persisted to localStorage, sessionStorage,
 *    or IndexedDB.
 * 3. Authoritative Server Rehydration: On load or navigation, session truth is
 *    always rehydrated from the server-managed HttpOnly cookie via GET /api/auth/me.
 * 4. Multi-Tenant / Identity Switch Guard: When a session ends, expires, or
 *    switches identity, active stores are purged (RTK Query cache wiped and root
 *    state reset to initial) to ensure no state leakage across tenant or role boundaries.
 * ============================================================================
 */

/**
 * Global root action that instructs role-specific root reducers to re-initialize
 * all slice state to initial values.
 */
export const purgeStoreAction = createAction('store/purge');

/**
 * Purges the Platform Super Admin store.
 * Dispatches RTK Query resetApiState to wipe in-flight queries and normalized cache,
 * then dispatches purgeStoreAction to reset root state.
 */
export function purgeAdminStore(store: AdminStore): void {
  try {
    store.dispatch(adminApi.util.resetApiState());
    store.dispatch(purgeStoreAction());
  } catch (err) {
    console.error('[resetStore] Error purging admin store:', err);
  }
}

/**
 * Purges the Company Admin store.
 * Dispatches RTK Query resetApiState to wipe in-flight queries and normalized cache,
 * then dispatches purgeStoreAction to reset root state.
 */
export function purgeCompanyStore(store: CompanyStore): void {
  try {
    store.dispatch(companyApi.util.resetApiState());
    store.dispatch(purgeStoreAction());
  } catch (err) {
    console.error('[resetStore] Error purging company store:', err);
  }
}

/**
 * Purges the Candidate store.
 * Dispatches RTK Query resetApiState to wipe in-flight queries and normalized cache,
 * then dispatches purgeStoreAction to reset root state.
 */
export function purgeCandidateStore(store: CandidateStore): void {
  try {
    store.dispatch(candidateApi.util.resetApiState());
    store.dispatch(purgeStoreAction());
  } catch (err) {
    console.error('[resetStore] Error purging candidate store:', err);
  }
}

/**
 * Role-agnostic purge helper.
 */
export function purgeRoleStore(
  role: 'admin' | 'company' | 'candidate',
  store: AdminStore | CompanyStore | CandidateStore,
): void {
  switch (role) {
    case 'admin':
      purgeAdminStore(store as AdminStore);
      break;
    case 'company':
      purgeCompanyStore(store as CompanyStore);
      break;
    case 'candidate':
      purgeCandidateStore(store as CandidateStore);
      break;
  }
}

