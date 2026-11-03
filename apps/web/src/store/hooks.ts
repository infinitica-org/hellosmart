import { createContext, useContext, type Context } from 'react';
import type {
  ReactReduxContextValue,
  TypedUseSelectorHook,
} from 'react-redux';
import {
  createDispatchHook,
  createSelectorHook,
  createStoreHook,
} from 'react-redux';
import type { AdminRootState, AdminDispatch, AdminStore } from './admin/adminStore';
import type { CompanyRootState, CompanyDispatch, CompanyStore } from './company/companyStore';
import type { CandidateRootState, CandidateDispatch, CandidateStore } from './candidate/candidateStore';

// Dedicated React Redux contexts for each role boundary
export const AdminReduxContext = createContext<ReactReduxContextValue | null>(null);
export const CompanyReduxContext = createContext<ReactReduxContextValue | null>(null);
export const CandidateReduxContext = createContext<ReactReduxContextValue | null>(null);

function formatProviderError(hookName: string, providerName: string): string {
  const article = providerName.startsWith('A') ? 'an' : 'a';
  return `${hookName} must be used within ${article} ${providerName}.`;
}

/**
 * Creates a role-guarded dispatch hook that ensures the hook is only called within its dedicated provider.
 */
function createRoleDispatchHook<TDispatch>(
  context: Context<ReactReduxContextValue | null>,
  hookName: string,
  providerName: string,
): () => TDispatch {
  const baseDispatch = createDispatchHook(context);

  return function useRoleDispatch(): TDispatch {
    const contextValue = useContext(context);
    if (!contextValue || !contextValue.store) {
      throw new Error(formatProviderError(hookName, providerName));
    }
    return baseDispatch() as TDispatch;
  };
}

/**
 * Creates a role-guarded selector hook that ensures the hook is only called within its dedicated provider.
 */
function createRoleSelectorHook<TRootState>(
  context: Context<ReactReduxContextValue | null>,
  hookName: string,
  providerName: string,
): TypedUseSelectorHook<TRootState> {
  const baseSelector = createSelectorHook(context);

  const useRoleSelector: TypedUseSelectorHook<TRootState> = ((
    selector: (state: TRootState) => unknown,
    equalityFnOrOptions?: unknown,
  ) => {
    const contextValue = useContext(context);
    if (!contextValue || !contextValue.store) {
      throw new Error(formatProviderError(hookName, providerName));
    }
    return (baseSelector as unknown as (sel: typeof selector, opt?: unknown) => unknown)(
      selector,
      equalityFnOrOptions,
    );
  }) as TypedUseSelectorHook<TRootState>;

  return useRoleSelector;
}

/**
 * Creates a role-guarded store hook that ensures the hook is only called within its dedicated provider.
 */
function createRoleStoreHook<TStore>(
  context: Context<ReactReduxContextValue | null>,
  hookName: string,
  providerName: string,
): () => TStore {
  const baseStore = createStoreHook(context);

  return function useRoleStore(): TStore {
    const contextValue = useContext(context);
    if (!contextValue || !contextValue.store) {
      throw new Error(formatProviderError(hookName, providerName));
    }
    return baseStore() as TStore;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform Admin Typed Hooks
// ─────────────────────────────────────────────────────────────────────────────
export const useAdminDispatch = createRoleDispatchHook<AdminDispatch>(
  AdminReduxContext,
  'useAdminDispatch',
  'AdminStoreProvider',
);

export const useAdminSelector = createRoleSelectorHook<AdminRootState>(
  AdminReduxContext,
  'useAdminSelector',
  'AdminStoreProvider',
);

export const useAdminStore = createRoleStoreHook<AdminStore>(
  AdminReduxContext,
  'useAdminStore',
  'AdminStoreProvider',
);

// ─────────────────────────────────────────────────────────────────────────────
// Company Admin Typed Hooks
// ─────────────────────────────────────────────────────────────────────────────
export const useCompanyDispatch = createRoleDispatchHook<CompanyDispatch>(
  CompanyReduxContext,
  'useCompanyDispatch',
  'CompanyStoreProvider',
);

export const useCompanySelector = createRoleSelectorHook<CompanyRootState>(
  CompanyReduxContext,
  'useCompanySelector',
  'CompanyStoreProvider',
);

export const useCompanyStore = createRoleStoreHook<CompanyStore>(
  CompanyReduxContext,
  'useCompanyStore',
  'CompanyStoreProvider',
);

// ─────────────────────────────────────────────────────────────────────────────
// Candidate Typed Hooks
// ─────────────────────────────────────────────────────────────────────────────
export const useCandidateDispatch = createRoleDispatchHook<CandidateDispatch>(
  CandidateReduxContext,
  'useCandidateDispatch',
  'CandidateStoreProvider',
);

export const useCandidateSelector = createRoleSelectorHook<CandidateRootState>(
  CandidateReduxContext,
  'useCandidateSelector',
  'CandidateStoreProvider',
);

export const useCandidateStore = createRoleStoreHook<CandidateStore>(
  CandidateReduxContext,
  'useCandidateStore',
  'CandidateStoreProvider',
);
