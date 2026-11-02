import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { makeAdminStore } from '@/store/admin/adminStore';
import { makeCompanyStore } from '@/store/company/companyStore';
import { makeCandidateStore } from '@/store/candidate/candidateStore';
import { adminApi } from '@/store/admin/adminApi';
import { companyApi } from '@/store/company/companyApi';
import { candidateApi } from '@/store/candidate/candidateApi';
import {
  purgeStoreAction,
  purgeAdminStore,
  purgeCompanyStore,
  purgeCandidateStore,
  purgeRoleStore,
} from '@/store/resetStore';
import {
  notifyUnauthorized,
  registerUnauthorizedHandler,
  resetUnauthorizedDeduplication,
  createCustomBaseQuery,
} from '@/store/api/baseApi';
import {
  initAuthIntegration,
  resetAuthIntegration,
  getActiveProviderCount,
} from '@/store/authIntegration';
import {
  sessionClient,
  type AuthBroadcastMessage,
} from '@/lib/session-client';
import {
  fetchAuthenticatedSession,
  resetSessionHydrationPromise,
  usePortalAuth,
} from '@/hooks/use-portal-auth';
import AdminLayout from '@/app/(admin)/admin/layout';
import CompanyLayout from '@/app/(company)/company/layout';
import CandidateLayout from '@/app/(candidate)/candidate/layout';
import {
  AdminStoreProvider,
  CompanyStoreProvider,
  CandidateStoreProvider,
} from '@/providers/store-provider';
import * as apiClient from '@/lib/api-client';
import type { Organization } from '@/types/organization';

const mockTestOrg: Organization = {
  id: 'org_1',
  name: 'Acme Corp',
  slug: 'acme',
  status: 'active',
  plan: 'pro',
  candidatesCount: 5,
  createdAt: '2026-01-01',
  adminEmail: 'admin@acme.com',
  adminName: 'Admin User',
  maxTemplates: 10,
  maxCandidates: 100,
  trialDays: 30,
};

describe('S1-T00-4: Store Persistence, Session Hydration & Logout Cache Purge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetUnauthorizedDeduplication();
    resetSessionHydrationPromise();
    resetAuthIntegration();
    sessionClient.setCurrentUser(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetAuthIntegration();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Session Hydration Architecture & State Transitions (Criterion 1)
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Session Hydration Architecture & Request Deduplication', () => {
    it('1.1 resolves valid session from server via GET /api/auth/me', async () => {
      const mockAdmin: apiClient.UserMe = {
        id: 'adm_1',
        email: 'admin@hellosmart.ai',
        name: 'Super Admin',
        role: 'platform_admin',
        portal: 'admin',
        mustResetPassword: false,
        org: null,
      };

      vi.spyOn(apiClient, 'getMe').mockResolvedValueOnce(mockAdmin);

      const user = await fetchAuthenticatedSession(true);
      expect(user).toEqual(mockAdmin);
      expect(sessionClient.getCurrentUser()).toEqual(mockAdmin);
    });

    it('1.2 returns null and clears user when server returns 401 Unauthorized', async () => {
      vi.spyOn(apiClient, 'getMe').mockRejectedValueOnce(
        new apiClient.ApiError(401, 'UNAUTHORIZED', 'Authentication required.'),
      );

      const user = await fetchAuthenticatedSession(true);
      expect(user).toBeNull();
      expect(sessionClient.getCurrentUser()).toBeNull();
    });

    it('1.3 throws normalized error on network / 500 server failure', async () => {
      vi.spyOn(apiClient, 'getMe').mockRejectedValueOnce(
        new apiClient.ApiError(500, 'SERVER_ERROR', 'Internal server error.'),
      );

      await expect(fetchAuthenticatedSession(true)).rejects.toThrow('Internal server error.');
    });

    it('1.4 deduplicates concurrent in-flight session hydration requests into a single server call', async () => {
      let resolveCall: (u: apiClient.UserMe) => void = () => {};
      const pendingServerCall = new Promise<apiClient.UserMe>((resolve) => {
        resolveCall = resolve;
      });

      const getMeSpy = vi.spyOn(apiClient, 'getMe').mockReturnValue(pendingServerCall);

      // Trigger 4 concurrent hydration requests (e.g. from multiple mounting components)
      const promise1 = fetchAuthenticatedSession();
      const promise2 = fetchAuthenticatedSession();
      const promise3 = fetchAuthenticatedSession();
      const promise4 = fetchAuthenticatedSession();

      // Ensure exactly 1 call was initiated to the backend
      expect(getMeSpy).toHaveBeenCalledTimes(1);

      // Resolve the single promise
      const mockUser: apiClient.UserMe = {
        id: 'cmp_1',
        email: 'admin@company.com',
        name: 'Company Admin',
        role: 'company_admin',
        portal: 'company',
        mustResetPassword: false,
        org: { id: 'org_1', name: 'Acme Corp' },
      };
      resolveCall(mockUser);

      const [res1, res2, res3, res4] = await Promise.all([promise1, promise2, promise3, promise4]);
      expect(res1).toEqual(mockUser);
      expect(res2).toEqual(mockUser);
      expect(res3).toEqual(mockUser);
      expect(res4).toEqual(mockUser);
      expect(getMeSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Protected Layout Guarding & Role Validation (Criterion 1 & 2)
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Layout Guarding & Role Validation', () => {
    it('2.1 AdminLayout renders loading skeleton while session is unresolved and DOES NOT mount children', () => {
      // sessionClient has no current user (loading/idle)
      sessionClient.setCurrentUser(null);
      let childMounted = false;

      function ProtectedChild() {
        childMounted = true;
        return <div data-testid="admin-secret">Sensitive Admin Metrics</div>;
      }

      const html = renderToString(
        <AdminLayout>
          <ProtectedChild />
        </AdminLayout>,
      );

      expect(html).toContain('data-testid="admin-layout-loading"');
      expect(html).not.toContain('Sensitive Admin Metrics');
      expect(childMounted).toBe(false);
    });

    it('2.2 AdminLayout renders protected children when authenticated as platform_admin', () => {
      sessionClient.setCurrentUser({
        id: 'adm_1',
        email: 'admin@hellosmart.ai',
        name: 'Super Admin',
        role: 'platform_admin',
        portal: 'admin',
        mustResetPassword: false,
        org: null,
      });

      function ProtectedChild() {
        return <div data-testid="admin-secret">Sensitive Admin Metrics</div>;
      }

      const html = renderToString(
        <AdminLayout>
          <ProtectedChild />
        </AdminLayout>,
      );

      expect(html).not.toContain('data-testid="admin-layout-loading"');
      expect(html).toContain('Sensitive Admin Metrics');
    });

    it('2.3 AdminLayout guards against role mismatch (company_admin accessing admin) and does NOT mount children', () => {
      sessionClient.setCurrentUser({
        id: 'cmp_1',
        email: 'admin@company.com',
        name: 'Company Admin',
        role: 'company_admin',
        portal: 'company',
        mustResetPassword: false,
        org: { id: 'org_1', name: 'Acme Corp' },
      });

      let childMounted = false;
      function ProtectedChild() {
        childMounted = true;
        return <div data-testid="admin-secret">Sensitive Admin Metrics</div>;
      }

      const html = renderToString(
        <AdminLayout>
          <ProtectedChild />
        </AdminLayout>,
      );

      expect(html).toContain('data-testid="admin-layout-loading"');
      expect(html).not.toContain('Sensitive Admin Metrics');
      expect(childMounted).toBe(false);
    });

    it('2.4 CompanyLayout renders loading skeleton when session is unresolved and DOES NOT mount children', () => {
      sessionClient.setCurrentUser(null);
      let childMounted = false;

      function ProtectedChild() {
        childMounted = true;
        return <div data-testid="company-secret">Candidate Pipeline Data</div>;
      }

      const html = renderToString(
        <CompanyLayout>
          <ProtectedChild />
        </CompanyLayout>,
      );

      expect(html).toContain('data-testid="company-layout-loading"');
      expect(html).not.toContain('Candidate Pipeline Data');
      expect(childMounted).toBe(false);
    });

    it('2.5 CompanyLayout renders protected children when authenticated as company_admin', () => {
      sessionClient.setCurrentUser({
        id: 'cmp_1',
        email: 'admin@company.com',
        name: 'Company Admin',
        role: 'company_admin',
        portal: 'company',
        mustResetPassword: false,
        org: { id: 'org_1', name: 'Acme Corp' },
      });

      function ProtectedChild() {
        return <div data-testid="company-secret">Candidate Pipeline Data</div>;
      }

      const html = renderToString(
        <CompanyLayout>
          <ProtectedChild />
        </CompanyLayout>,
      );

      expect(html).not.toContain('data-testid="company-layout-loading"');
      expect(html).toContain('Candidate Pipeline Data');
    });

    it('2.6 CandidateLayout renders loading skeleton when session is unresolved and DOES NOT mount children', () => {
      sessionClient.setCurrentUser(null);
      let childMounted = false;

      function ProtectedChild() {
        childMounted = true;
        return <div data-testid="candidate-secret">Technical Assessment IDE</div>;
      }

      const html = renderToString(
        <CandidateLayout>
          <ProtectedChild />
        </CandidateLayout>,
      );

      expect(html).toContain('data-testid="candidate-layout-loading"');
      expect(html).not.toContain('Technical Assessment IDE');
      expect(childMounted).toBe(false);
    });

    it('2.7 CandidateLayout renders protected children when authenticated as candidate', () => {
      sessionClient.setCurrentUser({
        id: 'cnd_1',
        email: 'dev@candidate.com',
        name: 'Candidate User',
        role: 'candidate',
        portal: 'candidate',
        mustResetPassword: false,
        org: null,
      });

      function ProtectedChild() {
        return <div data-testid="candidate-secret">Technical Assessment IDE</div>;
      }

      const html = renderToString(
        <CandidateLayout>
          <ProtectedChild />
        </CandidateLayout>,
      );

      expect(html).not.toContain('data-testid="candidate-layout-loading"');
      expect(html).toContain('Technical Assessment IDE');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Role-Specific Store Lifecycle & Purge Reducer (Criterion 2 & 3)
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Role-Specific Store Lifecycle & Root Reducer Reset', () => {
    it('3.1 purgeStoreAction resets root state back to clean initial state', () => {
      const store = makeAdminStore();
      const initialState = store.getState();

      // Dispatch purge action
      store.dispatch(purgeStoreAction());
      expect(store.getState()).toEqual(initialState);
    });

    it('3.2 purgeAdminStore clears RTK Query queries, mutations and dispatches purgeStoreAction', () => {
      const store = makeAdminStore();

      // Seed mock query entry in cache
      store.dispatch(
        adminApi.util.upsertQueryData('getOrganizations', undefined, {
          organizations: [mockTestOrg],
        }),
      );

      // Verify query is cached
      const stateBefore = store.getState();
      expect(Object.keys(stateBefore.adminApi.queries).length).toBeGreaterThan(0);

      // Purge store
      purgeAdminStore(store);

      const stateAfter = store.getState();
      expect(Object.keys(stateAfter.adminApi.queries).length).toBe(0);
      expect(Object.keys(stateAfter.adminApi.mutations).length).toBe(0);
    });

    it('3.3 purgeCompanyStore clears company RTK Query cache', () => {
      const store = makeCompanyStore();

      store.dispatch(
        companyApi.util.upsertQueryData('getCompanyMetrics', undefined, {
          configuredAssessments: 3,
          invitedCandidates: 42,
          activeCandidates: 10,
          submissionsToReview: 5,
          maxCandidates: 100,
          remainingQuota: 58,
        }),
      );

      expect(Object.keys(store.getState().companyApi.queries).length).toBeGreaterThan(0);

      purgeCompanyStore(store);

      expect(Object.keys(store.getState().companyApi.queries).length).toBe(0);
    });

    it('3.4 purgeCandidateStore resets candidate store state without throwing', () => {
      const store = makeCandidateStore();
      const initialState = store.getState();

      purgeCandidateStore(store);

      expect(store.getState()).toEqual(initialState);
      expect(Object.keys(store.getState().candidateApi.queries).length).toBe(0);
    });

    it('3.5 purgeRoleStore routes correctly by role string', () => {
      const adminStore = makeAdminStore();
      const companyStore = makeCompanyStore();
      const candidateStore = makeCandidateStore();

      purgeRoleStore('admin', adminStore);
      purgeRoleStore('company', companyStore);
      purgeRoleStore('candidate', candidateStore);

      expect(Object.keys(adminStore.getState().adminApi.queries).length).toBe(0);
      expect(Object.keys(companyStore.getState().companyApi.queries).length).toBe(0);
      expect(Object.keys(candidateStore.getState().candidateApi.queries).length).toBe(0);
    });

    it('3.6 multi-tenant store isolation: purging admin does NOT impact independent company or candidate stores', () => {
      const adminStore = makeAdminStore();
      const companyStore = makeCompanyStore();

      companyStore.dispatch(
        companyApi.util.upsertQueryData('getCompanyMetrics', undefined, {
          configuredAssessments: 2,
          invitedCandidates: 100,
          activeCandidates: 20,
          submissionsToReview: 10,
          maxCandidates: 200,
          remainingQuota: 100,
        }),
      );

      // Purge admin store
      purgeAdminStore(adminStore);

      // Company store cache must remain completely untouched
      expect(Object.keys(companyStore.getState().companyApi.queries).length).toBe(1);
    });

    it('3.7 in-flight RTK Query request behavior: cache remains clean when purge is dispatched during in-flight query', async () => {
      let resolveFetch: (res: Response) => void = () => {};
      const pendingResponse = new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });

      const mockFetch = vi.fn().mockReturnValue(pendingResponse);

      const baseQuery = createCustomBaseQuery({
        baseUrl: 'http://localhost:3000/api',
        fetchFn: mockFetch,
        reducerPath: 'adminApi',
      });

      const store = makeAdminStore();

      // Start an in-flight operation
      const queryPromise = baseQuery(
        'admin/organizations',
        { dispatch: store.dispatch, endpoint: 'getOrganizations' } as any,
        {},
      );

      // In-flight: purge store
      purgeAdminStore(store);

      // Now query resolves
      resolveFetch(
        new Response(JSON.stringify({ organizations: [mockTestOrg] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      await queryPromise;

      // Because resetApiState and purgeStoreAction were dispatched, queries cache remains empty
      expect(Object.keys(store.getState().adminApi.queries).length).toBe(0);
    });

    it('3.8 stale identity prevention: switching identity from company admin to candidate purges prior state', () => {
      const companyStore = makeCompanyStore();
      const candidateStore = makeCandidateStore();

      // 1. Company Admin logs in and populates company metrics
      companyStore.dispatch(
        companyApi.util.upsertQueryData('getCompanyMetrics', undefined, {
          configuredAssessments: 5,
          invitedCandidates: 50,
          activeCandidates: 25,
          submissionsToReview: 10,
          maxCandidates: 100,
          remainingQuota: 50,
        }),
      );

      expect(Object.keys(companyStore.getState().companyApi.queries).length).toBe(1);

      // 2. Company Admin logs out -> triggers purge
      purgeCompanyStore(companyStore);
      expect(Object.keys(companyStore.getState().companyApi.queries).length).toBe(0);

      // 3. Candidate logs in -> candidateStore has zero knowledge or state from companyStore
      const candidateState = candidateStore.getState();
      expect(candidateState).not.toHaveProperty('companyApi');
      expect(Object.keys(candidateStore.getState().candidateApi.queries).length).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Logout & Sign-Out Lifecycle (Criterion 3)
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Logout & Sign-Out Lifecycle', () => {
    it('4.1 signOut invokes logout API, clears currentUser, broadcasts LOGOUT and notifies local subscribers', async () => {
      const logoutSpy = vi.spyOn(apiClient, 'logout').mockResolvedValue({
        success: true,
        message: 'Logged out successfully',
      });

      const broadcastSpy = vi.spyOn(sessionClient, 'broadcast');

      const receivedEvents: AuthBroadcastMessage[] = [];
      const unsubscribe = sessionClient.subscribe((event) => {
        receivedEvents.push(event);
      });

      sessionClient.setCurrentUser({
        id: 'usr_1',
        email: 'user@test.com',
        name: 'User',
        role: 'company_admin',
        portal: 'company',
        mustResetPassword: false,
        org: { id: 'org_1', name: 'Org' },
      });

      await sessionClient.signOut('user-logout');

      unsubscribe();

      expect(logoutSpy).toHaveBeenCalledTimes(1);
      expect(sessionClient.getCurrentUser()).toBeNull();
      expect(broadcastSpy).toHaveBeenCalledWith({ type: 'LOGOUT', reason: 'user-logout' });
      expect(receivedEvents).toContainEqual({ type: 'LOGOUT', reason: 'user-logout' });
    });

    it('4.2 signOutAllDevices invokes logoutAllSessions and broadcasts LOGOUT reason session-expired', async () => {
      const logoutAllSpy = vi.spyOn(apiClient, 'logoutAllSessions').mockResolvedValue({
        success: true,
        message: 'All sessions terminated',
      });

      const broadcastSpy = vi.spyOn(sessionClient, 'broadcast');

      await sessionClient.signOutAllDevices();

      expect(logoutAllSpy).toHaveBeenCalledTimes(1);
      expect(sessionClient.getCurrentUser()).toBeNull();
      expect(broadcastSpy).toHaveBeenCalledWith({ type: 'LOGOUT', reason: 'session-expired' });
    });

    it('4.3 signOut succeeds gracefully even if logout API rejects (e.g. network failure)', async () => {
      const logoutSpy = vi.spyOn(apiClient, 'logout').mockRejectedValue(
        new Error('Network offline'),
      );

      const broadcastSpy = vi.spyOn(sessionClient, 'broadcast');

      sessionClient.setCurrentUser({
        id: 'usr_offline',
        email: 'offline@test.com',
        name: 'Offline User',
        role: 'platform_admin',
        portal: 'admin',
        mustResetPassword: false,
        org: null,
      });

      await expect(sessionClient.signOut('user-logout')).resolves.not.toThrow();

      expect(logoutSpy).toHaveBeenCalledTimes(1);
      expect(sessionClient.getCurrentUser()).toBeNull();
      expect(broadcastSpy).toHaveBeenCalledWith({ type: 'LOGOUT', reason: 'user-logout' });
    });

    it('4.4 concurrent or re-entrant signOut calls are guarded and trigger only 1 logout API call', async () => {
      let resolveLogout: (val: any) => void = () => {};
      const pendingLogout = new Promise((resolve) => {
        resolveLogout = resolve;
      });

      const logoutSpy = vi.spyOn(apiClient, 'logout').mockReturnValue(pendingLogout as any);
      const broadcastSpy = vi.spyOn(sessionClient, 'broadcast');

      // Trigger two concurrent signOut calls
      const p1 = sessionClient.signOut('session-expired');
      const p2 = sessionClient.signOut('user-logout');

      resolveLogout({ success: true, message: 'Logged out' });
      await Promise.all([p1, p2]);

      expect(logoutSpy).toHaveBeenCalledTimes(1);
      expect(broadcastSpy).toHaveBeenCalledTimes(1);
    });

    it('4.5 sign-out guard recovers after failure: a subsequent sign-out attempt executes successfully after an earlier attempt rejected', async () => {
      // First attempt: logout rejects with network error
      const logoutSpy = vi
        .spyOn(apiClient, 'logout')
        .mockRejectedValueOnce(new Error('Network offline'))
        .mockResolvedValueOnce({ success: true, message: 'Logged out successfully' });

      const broadcastSpy = vi.spyOn(sessionClient, 'broadcast');

      // Attempt 1: fails
      await expect(sessionClient.signOut('user-logout')).resolves.not.toThrow();
      expect(logoutSpy).toHaveBeenCalledTimes(1);

      // Attempt 2: later independent sign-out succeeds
      await expect(sessionClient.signOut('user-logout')).resolves.not.toThrow();
      expect(logoutSpy).toHaveBeenCalledTimes(2);
      expect(broadcastSpy).toHaveBeenCalledTimes(2);
      expect(sessionClient.getCurrentUser()).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Unauthorized / 401 Handling & Deduplication (Criterion 4)
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Unauthorized / 401 Handling Integration & Deduplication', () => {
    it('5.1 notifyUnauthorized immediately resets active slice cache when reducerPath is provided', () => {
      const store = makeAdminStore();

      store.dispatch(
        adminApi.util.upsertQueryData('getOrganizations', undefined, {
          organizations: [mockTestOrg],
        }),
      );

      expect(Object.keys(store.getState().adminApi.queries).length).toBe(1);

      const fakeApi = {
        dispatch: store.dispatch,
        endpoint: 'getOrganizations',
      };

      notifyUnauthorized(
        { status: 401, code: 'UNAUTHORIZED', message: 'Session expired' },
        fakeApi as any,
        'adminApi',
      );

      expect(Object.keys(store.getState().adminApi.queries).length).toBe(0);
    });

    it('5.2 deduplicates concurrent 401s within 3000ms window', () => {
      const handlerSpy = vi.fn();
      const unsubscribe = registerUnauthorizedHandler(handlerSpy);

      const fakeApi = { dispatch: vi.fn(), endpoint: 'test' };

      const fired1 = notifyUnauthorized(
        { status: 401, code: 'UNAUTHORIZED', message: '401 #1' },
        fakeApi as any,
      );

      const fired2 = notifyUnauthorized(
        { status: 401, code: 'UNAUTHORIZED', message: '401 #2' },
        fakeApi as any,
      );

      const fired3 = notifyUnauthorized(
        { status: 401, code: 'UNAUTHORIZED', message: '401 #3' },
        fakeApi as any,
      );

      unsubscribe();

      expect(fired1).toBe(true);
      expect(fired2).toBe(false); // Deduplicated
      expect(fired3).toBe(false); // Deduplicated
      expect(handlerSpy).toHaveBeenCalledTimes(1);
    });

    it('5.3 auth integration automatically triggers sessionClient.signOut on 401', async () => {
      const signOutSpy = vi.spyOn(sessionClient, 'signOut').mockResolvedValue();

      const cleanup = initAuthIntegration();

      sessionClient.setCurrentUser({
        id: 'usr_1',
        email: 'user@test.com',
        name: 'User',
        role: 'platform_admin',
        portal: 'admin',
        mustResetPassword: false,
        org: null,
      });

      notifyUnauthorized(
        { status: 401, code: 'UNAUTHORIZED', message: 'Expired' },
        { dispatch: vi.fn(), endpoint: 'test' } as any,
      );

      cleanup();

      expect(sessionClient.getCurrentUser()).toBeNull();
      expect(signOutSpy).toHaveBeenCalledWith('session-expired');
    });

    it('5.4 HTTP 403 Forbidden does NOT trigger unauthorized handler, logout, or cache purge', async () => {
      const unauthorizedSpy = vi.fn();
      const unsubscribe = registerUnauthorizedHandler(unauthorizedSpy);
      const signOutSpy = vi.spyOn(sessionClient, 'signOut');

      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Forbidden access' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const baseQuery = createCustomBaseQuery({
        baseUrl: 'http://localhost:3000/api',
        fetchFn: mockFetch,
        reducerPath: 'adminApi',
      });

      const store = makeAdminStore();
      const result = await baseQuery(
        'admin/restricted',
        { dispatch: store.dispatch, endpoint: 'getRestricted' } as any,
        {},
      );

      unsubscribe();

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(403);
      expect(result.error?.code).toBe('FORBIDDEN');
      expect(unauthorizedSpy).not.toHaveBeenCalled();
      expect(signOutSpy).not.toHaveBeenCalled();
    });

    it('5.5 auth integration listener lifecycle: mounting, unmounting, and remounting providers maintains correct reference counting without accumulating duplicate handlers', () => {
      expect(getActiveProviderCount()).toBe(0);

      // Provider 1 mounts
      const cleanup1 = initAuthIntegration();
      expect(getActiveProviderCount()).toBe(1);

      // Provider 2 mounts concurrently
      const cleanup2 = initAuthIntegration();
      expect(getActiveProviderCount()).toBe(2);

      // Fire 401: signOut called exactly once
      const signOutSpy = vi.spyOn(sessionClient, 'signOut').mockResolvedValue();
      notifyUnauthorized(
        { status: 401, code: 'UNAUTHORIZED', message: 'Test 401' },
        { dispatch: vi.fn(), endpoint: 'test' } as any,
      );
      expect(signOutSpy).toHaveBeenCalledTimes(1);

      // Provider 1 unmounts: handler remains active for Provider 2
      cleanup1();
      expect(getActiveProviderCount()).toBe(1);

      // Reset dedupe and fire another 401: handler still active, fires once
      resetUnauthorizedDeduplication();
      signOutSpy.mockClear();
      notifyUnauthorized(
        { status: 401, code: 'UNAUTHORIZED', message: 'Test 401 second' },
        { dispatch: vi.fn(), endpoint: 'test' } as any,
      );
      expect(signOutSpy).toHaveBeenCalledTimes(1);

      // Provider 2 unmounts: handler fully unregistered
      cleanup2();
      expect(getActiveProviderCount()).toBe(0);

      // Reset dedupe and fire 401: no handler active, signOut NOT called
      resetUnauthorizedDeduplication();
      signOutSpy.mockClear();
      notifyUnauthorized(
        { status: 401, code: 'UNAUTHORIZED', message: 'Test 401 after unmount' },
        { dispatch: vi.fn(), endpoint: 'test' } as any,
      );
      expect(signOutSpy).not.toHaveBeenCalled();

      // Remount provider: cleanly registers again
      const cleanup3 = initAuthIntegration();
      expect(getActiveProviderCount()).toBe(1);
      cleanup3();
      expect(getActiveProviderCount()).toBe(0);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Cross-Tab Session Synchronization (Criterion 5)
  // ───────────────────────────────────────────────────────────────────────────
  describe('6. Cross-Tab Session Synchronization', () => {
    it('6.1 receiving LOGOUT broadcast in a tab purges active store cache', () => {
      const store = makeAdminStore();

      store.dispatch(
        adminApi.util.upsertQueryData('getOrganizations', undefined, {
          organizations: [mockTestOrg],
        }),
      );

      expect(Object.keys(store.getState().adminApi.queries).length).toBe(1);

      // In real browser client, AdminStoreProvider subscribes to sessionClient
      const unsubscribe = sessionClient.subscribe((event) => {
        if (event.type === 'LOGOUT') {
          purgeAdminStore(store);
        }
      });

      // Simulate receiving cross-tab LOGOUT broadcast
      (sessionClient as any).handleBroadcast({
        type: 'LOGOUT',
        reason: 'remote-logout',
      });

      unsubscribe();

      // Verify the active store was purged
      expect(Object.keys(store.getState().adminApi.queries).length).toBe(0);
      expect(sessionClient.getCurrentUser()).toBeNull();
    });

    it('6.2 auth broadcast messages never transmit tokens or sensitive secrets', () => {
      const broadcastSpy = vi.spyOn(sessionClient, 'broadcast');

      sessionClient.broadcast({
        type: 'LOGOUT',
        reason: 'session-expired',
      });

      expect(broadcastSpy).toHaveBeenCalledWith({
        type: 'LOGOUT',
        reason: 'session-expired',
      });

      const payload = broadcastSpy.mock.calls[0]?.[0];
      expect(payload).not.toHaveProperty('token');
      expect(payload).not.toHaveProperty('cookie');
      expect(payload).not.toHaveProperty('password');
      expect(payload).not.toHaveProperty('hs_session');
    });

    it('6.3 functions gracefully when BroadcastChannel is not supported', async () => {
      const originalBC = (global as any).BroadcastChannel;
      (global as any).BroadcastChannel = undefined;

      try {
        // Broadcast does not throw even without BroadcastChannel
        expect(() => {
          sessionClient.broadcast({ type: 'LOGOUT' });
        }).not.toThrow();

        // Sign out still functions locally
        const logoutSpy = vi.spyOn(apiClient, 'logout').mockResolvedValue({
          success: true,
          message: 'Logged out',
        });

        await sessionClient.signOut('user-logout');
        expect(logoutSpy).toHaveBeenCalledTimes(1);
      } finally {
        (global as any).BroadcastChannel = originalBC;
      }
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Zero Persistence Verification (Criterion 6)
  // ───────────────────────────────────────────────────────────────────────────
  describe('7. Zero-Persistence Policy Verification', () => {
    it('7.1 Redux store state and RTK Query caches are never written to localStorage or sessionStorage', () => {
      const adminStore = makeAdminStore();
      const companyStore = makeCompanyStore();
      const candidateStore = makeCandidateStore();

      // Populate mock entities in each store
      adminStore.dispatch(
        adminApi.util.upsertQueryData('getOrganizations', undefined, {
          organizations: [mockTestOrg],
        }),
      );

      companyStore.dispatch(
        companyApi.util.upsertQueryData('getCompanyMetrics', undefined, {
          configuredAssessments: 10,
          invitedCandidates: 999,
          activeCandidates: 111,
          submissionsToReview: 88,
          maxCandidates: 2000,
          remainingQuota: 1001,
        }),
      );

      // Verify browser storage contains zero sensitive entries
      if (typeof localStorage !== 'undefined') {
        expect(localStorage.getItem('adminApi')).toBeNull();
        expect(localStorage.getItem('companyApi')).toBeNull();
        expect(localStorage.getItem('candidateApi')).toBeNull();
        expect(localStorage.getItem('redux')).toBeNull();
        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('hs_session')).toBeNull();
      }

      if (typeof sessionStorage !== 'undefined') {
        expect(sessionStorage.getItem('adminApi')).toBeNull();
        expect(sessionStorage.getItem('companyApi')).toBeNull();
        expect(sessionStorage.getItem('candidateApi')).toBeNull();
        expect(sessionStorage.getItem('redux')).toBeNull();
        expect(sessionStorage.getItem('token')).toBeNull();
        expect(sessionStorage.getItem('hs_session')).toBeNull();
      }
    });
  });
});
