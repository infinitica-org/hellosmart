'use client';

import React, { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Provider } from 'react-redux';
import { makeAdminStore, type AdminStore } from '@/store/admin/adminStore';
import { makeCompanyStore, type CompanyStore } from '@/store/company/companyStore';
import { makeCandidateStore, type CandidateStore } from '@/store/candidate/candidateStore';
import { AdminReduxContext, CompanyReduxContext, CandidateReduxContext } from '@/store/hooks';
import { sessionClient } from '@/lib/session-client';
import { purgeAdminStore, purgeCompanyStore, purgeCandidateStore } from '@/store/resetStore';
import { initAuthIntegration } from '@/store/authIntegration';

export interface AdminStoreProviderProps {
  children: React.ReactNode;
  /** Optional pre-configured store instance for testing / dependency injection */
  store?: AdminStore;
}

/**
 * Redux Toolkit provider for Platform Super Admin.
 * Uses dedicated AdminReduxContext to guarantee isolation from company/candidate stores.
 * Store instance remains completely stable across component rerenders.
 * Subscribes to logout and cross-tab session invalidation events to purge RTK Query cache.
 */
export function AdminStoreProvider({
  children,
  store,
}: AdminStoreProviderProps): React.JSX.Element {
  const storeRef = useRef<AdminStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = store ?? makeAdminStore();
  }

  useEffect(() => {
    const cleanupAuth = initAuthIntegration();

    // Subscribe to cross-tab auth broadcast and local sign-out events
    const unsubscribeSession = sessionClient.subscribe((event) => {
      if (event.type === 'LOGOUT') {
        if (storeRef.current) {
          purgeAdminStore(storeRef.current);
        }
      }
    });

    return () => {
      cleanupAuth();
      unsubscribeSession();
    };
  }, []);

  return (
    <Provider store={storeRef.current} context={AdminReduxContext}>
      <Provider store={storeRef.current}>{children}</Provider>
    </Provider>
  );
}

export interface CompanyStoreProviderProps {
  children: React.ReactNode;
  /** Optional pre-configured store instance for testing / dependency injection */
  store?: CompanyStore;
}

/**
 * Redux Toolkit provider for Company Admin.
 * Uses dedicated CompanyReduxContext to guarantee isolation from admin/candidate stores.
 * Store instance remains completely stable across component rerenders.
 * Subscribes to logout and cross-tab session invalidation events to purge RTK Query cache.
 */
export function CompanyStoreProvider({
  children,
  store,
}: CompanyStoreProviderProps): React.JSX.Element {
  const storeRef = useRef<CompanyStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = store ?? makeCompanyStore();
  }

  useEffect(() => {
    const cleanupAuth = initAuthIntegration();

    // Subscribe to cross-tab auth broadcast and local sign-out events
    const unsubscribeSession = sessionClient.subscribe((event) => {
      if (event.type === 'LOGOUT') {
        if (storeRef.current) {
          purgeCompanyStore(storeRef.current);
        }
      }
    });

    return () => {
      cleanupAuth();
      unsubscribeSession();
    };
  }, []);

  return (
    <Provider store={storeRef.current} context={CompanyReduxContext}>
      <Provider store={storeRef.current}>{children}</Provider>
    </Provider>
  );
}

export interface CandidateStoreProviderProps {
  children: React.ReactNode;
  /** Optional pre-configured store instance for testing / dependency injection */
  store?: CandidateStore;
}

/**
 * Redux Toolkit provider for Candidate portal.
 * Uses dedicated CandidateReduxContext to guarantee isolation from admin/company stores.
 * Store instance remains completely stable across component rerenders.
 * Subscribes to logout and cross-tab session invalidation events to purge RTK Query cache.
 */
export function CandidateStoreProvider({
  children,
  store,
}: CandidateStoreProviderProps): React.JSX.Element {
  const storeRef = useRef<CandidateStore | null>(null);
  if (storeRef.current === null) {
    storeRef.current = store ?? makeCandidateStore();
  }

  useEffect(() => {
    const cleanupAuth = initAuthIntegration();

    // Subscribe to cross-tab auth broadcast and local sign-out events
    const unsubscribeSession = sessionClient.subscribe((event) => {
      if (event.type === 'LOGOUT') {
        if (storeRef.current) {
          purgeCandidateStore(storeRef.current);
        }
      }
    });

    return () => {
      cleanupAuth();
      unsubscribeSession();
    };
  }, []);

  return (
    <Provider store={storeRef.current} context={CandidateReduxContext}>
      <Provider store={storeRef.current}>{children}</Provider>
    </Provider>
  );
}

export interface StoreProviderProps {
  children: React.ReactNode;
}

/**
 * Dynamic StoreProvider that mounts the isolated, role-specific RTK store based on active route/role.
 * - /admin/*     -> AdminStoreProvider (Super Admin)
 * - /company/*   -> CompanyStoreProvider (Company Admin)
 * - /candidate/* -> CandidateStoreProvider (Candidate)
 * Enforces memory isolation across roles (BR-01, BR-25).
 */
export function StoreProvider({ children }: StoreProviderProps): React.JSX.Element {
  const pathname = usePathname();

  if (pathname?.startsWith('/admin')) {
    return <AdminStoreProvider>{children}</AdminStoreProvider>;
  }
  if (pathname?.startsWith('/candidate')) {
    return <CandidateStoreProvider>{children}</CandidateStoreProvider>;
  }
  if (pathname?.startsWith('/company')) {
    return <CompanyStoreProvider>{children}</CompanyStoreProvider>;
  }

  return <>{children}</>;
}
