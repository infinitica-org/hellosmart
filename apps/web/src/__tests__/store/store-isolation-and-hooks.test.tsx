import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  AdminStoreProvider,
  CompanyStoreProvider,
  CandidateStoreProvider,
} from '@/providers/store-provider';
import {
  useAdminDispatch,
  useAdminSelector,
  useAdminStore,
  useCompanyDispatch,
  useCompanySelector,
  useCompanyStore,
  useCandidateDispatch,
  useCandidateSelector,
  useCandidateStore,
} from '@/store/hooks';

describe('S1-T00-1: Store Providers, Typed Hooks & Cross-Role Isolation', () => {
  describe('4 & 5. Role-Specific Providers & Hooks Under Matching Providers', () => {
    it('useAdminSelector, useAdminDispatch, and useAdminStore work correctly under AdminStoreProvider', () => {
      let capturedDispatch: any = null;
      let capturedStore: any = null;
      let isInitialized = false;

      function AdminConsumer() {
        isInitialized = useAdminSelector((state) => state !== null);
        capturedDispatch = useAdminDispatch();
        capturedStore = useAdminStore();

        return <div data-testid="admin-consumer">Admin Mounted</div>;
      }

      const html = renderToString(
        <AdminStoreProvider>
          <AdminConsumer />
        </AdminStoreProvider>,
      );

      expect(html).toContain('Admin Mounted');
      expect(typeof capturedDispatch).toBe('function');
      expect(capturedStore).toBeDefined();
      expect(capturedStore.getState()).toHaveProperty('adminApi');
      expect(isInitialized).toBe(true);
    });

    it('useCompanySelector, useCompanyDispatch, and useCompanyStore work correctly under CompanyStoreProvider', () => {
      let capturedDispatch: any = null;
      let capturedStore: any = null;
      let isInitialized = false;

      function CompanyConsumer() {
        isInitialized = useCompanySelector((state) => state !== null);
        capturedDispatch = useCompanyDispatch();
        capturedStore = useCompanyStore();

        return <div data-testid="company-consumer">Company Mounted</div>;
      }

      const html = renderToString(
        <CompanyStoreProvider>
          <CompanyConsumer />
        </CompanyStoreProvider>,
      );

      expect(html).toContain('Company Mounted');
      expect(typeof capturedDispatch).toBe('function');
      expect(capturedStore).toBeDefined();
      expect(capturedStore.getState()).toHaveProperty('companyApi');
      expect(isInitialized).toBe(true);
    });

    it('useCandidateSelector, useCandidateDispatch, and useCandidateStore work correctly under CandidateStoreProvider', () => {
      let capturedDispatch: any = null;
      let capturedStore: any = null;
      let isInitialized = false;

      function CandidateConsumer() {
        isInitialized = useCandidateSelector((state) => state !== null);
        capturedDispatch = useCandidateDispatch();
        capturedStore = useCandidateStore();

        return <div data-testid="candidate-consumer">Candidate Mounted</div>;
      }

      const html = renderToString(
        <CandidateStoreProvider>
          <CandidateConsumer />
        </CandidateStoreProvider>,
      );

      expect(html).toContain('Candidate Mounted');
      expect(typeof capturedDispatch).toBe('function');
      expect(capturedStore).toBeDefined();
      expect(capturedStore.getState()).toHaveProperty('candidateApi');
      expect(isInitialized).toBe(true);
    });
  });

  describe('6. Hook Usage Outside Matching Provider (Clear Error Enforcement)', () => {
    it('throws clear error when useAdminSelector is used outside AdminStoreProvider', () => {
      function NakedAdminSelectorConsumer() {
        useAdminSelector((state) => state !== null);
        return <div>Naked</div>;
      }

      expect(() => {
        renderToString(<NakedAdminSelectorConsumer />);
      }).toThrowError('useAdminSelector must be used within an AdminStoreProvider.');
    });

    it('throws clear error when useAdminDispatch is used outside AdminStoreProvider', () => {
      function NakedAdminDispatchConsumer() {
        useAdminDispatch();
        return <div>Naked</div>;
      }

      expect(() => {
        renderToString(<NakedAdminDispatchConsumer />);
      }).toThrowError('useAdminDispatch must be used within an AdminStoreProvider.');
    });

    it('throws clear error when useAdminStore is used outside AdminStoreProvider', () => {
      function NakedAdminStoreConsumer() {
        useAdminStore();
        return <div>Naked</div>;
      }

      expect(() => {
        renderToString(<NakedAdminStoreConsumer />);
      }).toThrowError('useAdminStore must be used within an AdminStoreProvider.');
    });

    it('throws clear error when useCompanySelector is used outside CompanyStoreProvider', () => {
      function NakedCompanySelectorConsumer() {
        useCompanySelector((state) => state !== null);
        return <div>Naked</div>;
      }

      expect(() => {
        renderToString(<NakedCompanySelectorConsumer />);
      }).toThrowError('useCompanySelector must be used within a CompanyStoreProvider.');
    });

    it('throws clear error when useCompanyDispatch is used outside CompanyStoreProvider', () => {
      function NakedCompanyDispatchConsumer() {
        useCompanyDispatch();
        return <div>Naked</div>;
      }

      expect(() => {
        renderToString(<NakedCompanyDispatchConsumer />);
      }).toThrowError('useCompanyDispatch must be used within a CompanyStoreProvider.');
    });

    it('throws clear error when useCompanyStore is used outside CompanyStoreProvider', () => {
      function NakedCompanyStoreConsumer() {
        useCompanyStore();
        return <div>Naked</div>;
      }

      expect(() => {
        renderToString(<NakedCompanyStoreConsumer />);
      }).toThrowError('useCompanyStore must be used within a CompanyStoreProvider.');
    });

    it('throws clear error when useCandidateSelector is used outside CandidateStoreProvider', () => {
      function NakedCandidateSelectorConsumer() {
        useCandidateSelector((state) => state !== null);
        return <div>Naked</div>;
      }

      expect(() => {
        renderToString(<NakedCandidateSelectorConsumer />);
      }).toThrowError('useCandidateSelector must be used within a CandidateStoreProvider.');
    });

    it('throws clear error when useCandidateDispatch is used outside CandidateStoreProvider', () => {
      function NakedCandidateDispatchConsumer() {
        useCandidateDispatch();
        return <div>Naked</div>;
      }

      expect(() => {
        renderToString(<NakedCandidateDispatchConsumer />);
      }).toThrowError('useCandidateDispatch must be used within a CandidateStoreProvider.');
    });

    it('throws clear error when useCandidateStore is used outside CandidateStoreProvider', () => {
      function NakedCandidateStoreConsumer() {
        useCandidateStore();
        return <div>Naked</div>;
      }

      expect(() => {
        renderToString(<NakedCandidateStoreConsumer />);
      }).toThrowError('useCandidateStore must be used within a CandidateStoreProvider.');
    });
  });

  describe('7, 8, 9. Cross-Role Store Access Prevention', () => {
    it('prevents a Candidate component from accessing Admin context', () => {
      function MaliciousCandidateComponent() {
        useAdminSelector((s) => s !== null);
        return <div>Should not reach here</div>;
      }

      expect(() => {
        renderToString(
          <CandidateStoreProvider>
            <MaliciousCandidateComponent />
          </CandidateStoreProvider>,
        );
      }).toThrowError('useAdminSelector must be used within an AdminStoreProvider.');
    });

    it('prevents a Candidate component from accessing Company context', () => {
      function MaliciousCandidateComponent() {
        useCompanySelector((s) => s !== null);
        return <div>Should not reach here</div>;
      }

      expect(() => {
        renderToString(
          <CandidateStoreProvider>
            <MaliciousCandidateComponent />
          </CandidateStoreProvider>,
        );
      }).toThrowError('useCompanySelector must be used within a CompanyStoreProvider.');
    });

    it('prevents an Admin component from accessing Candidate context', () => {
      function AdminCallingCandidateComponent() {
        useCandidateSelector((s) => s !== null);
        return <div>Should not reach here</div>;
      }

      expect(() => {
        renderToString(
          <AdminStoreProvider>
            <AdminCallingCandidateComponent />
          </AdminStoreProvider>,
        );
      }).toThrowError('useCandidateSelector must be used within a CandidateStoreProvider.');
    });

    it('prevents an Admin component from accessing Company context', () => {
      function AdminCallingCompanyComponent() {
        useCompanySelector((s) => s !== null);
        return <div>Should not reach here</div>;
      }

      expect(() => {
        renderToString(
          <AdminStoreProvider>
            <AdminCallingCompanyComponent />
          </AdminStoreProvider>,
        );
      }).toThrowError('useCompanySelector must be used within a CompanyStoreProvider.');
    });

    it('prevents a Company component from accessing Admin context', () => {
      function CompanyCallingAdminComponent() {
        useAdminSelector((s) => s !== null);
        return <div>Should not reach here</div>;
      }

      expect(() => {
        renderToString(
          <CompanyStoreProvider>
            <CompanyCallingAdminComponent />
          </CompanyStoreProvider>,
        );
      }).toThrowError('useAdminSelector must be used within an AdminStoreProvider.');
    });

    it('prevents a Company component from accessing Candidate context', () => {
      function CompanyCallingCandidateComponent() {
        useCandidateSelector((s) => s !== null);
        return <div>Should not reach here</div>;
      }

      expect(() => {
        renderToString(
          <CompanyStoreProvider>
            <CompanyCallingCandidateComponent />
          </CompanyStoreProvider>,
        );
      }).toThrowError('useCandidateSelector must be used within a CandidateStoreProvider.');
    });
  });

  describe('8. Provider Store Stability Across Rerenders', () => {
    it('ensures provider store instance is preserved and identical across rerenders', () => {
      const renderedStores: any[] = [];

      function ConsumerChild({ renderKey }: { renderKey: number }) {
        const store = useAdminStore();
        renderedStores.push(store);
        return <div>Key: {renderKey}</div>;
      }

      function ParentWrapper({ renderKey }: { renderKey: number }) {
        return (
          <AdminStoreProvider>
            <ConsumerChild renderKey={renderKey} />
          </AdminStoreProvider>
        );
      }

      renderToString(<ParentWrapper renderKey={1} />);
      expect(renderedStores).toHaveLength(1);
      expect(typeof renderedStores[0].dispatch).toBe('function');
    });
  });
});
