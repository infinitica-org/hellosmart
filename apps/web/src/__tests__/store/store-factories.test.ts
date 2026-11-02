import { describe, it, expect } from 'vitest';
import { makeAdminStore } from '@/store/admin/adminStore';
import { makeCompanyStore } from '@/store/company/companyStore';
import { makeCandidateStore } from '@/store/candidate/candidateStore';

describe('S1-T00-1: Store Factories & State Independence', () => {
  describe('1. Store Creation & Validity', () => {
    it('makeAdminStore() creates a valid Redux Toolkit store for platform admin with clean root state', () => {
      const store = makeAdminStore();
      expect(store).toBeDefined();
      expect(typeof store.dispatch).toBe('function');
      expect(typeof store.getState).toBe('function');
      expect(typeof store.subscribe).toBe('function');

      const state = store.getState();
      expect(state).toHaveProperty('adminApi');
      expect(state).not.toHaveProperty('companyApi');
      expect(state).not.toHaveProperty('candidateApi');
    });

    it('makeCompanyStore() creates a valid Redux Toolkit store for company admin with clean root state', () => {
      const store = makeCompanyStore();
      expect(store).toBeDefined();
      expect(typeof store.dispatch).toBe('function');
      expect(typeof store.getState).toBe('function');
      expect(typeof store.subscribe).toBe('function');

      const state = store.getState();
      expect(state).toHaveProperty('companyApi');
      expect(state).not.toHaveProperty('adminApi');
      expect(state).not.toHaveProperty('candidateApi');
    });

    it('makeCandidateStore() creates a valid Redux Toolkit store for candidate with clean root state', () => {
      const store = makeCandidateStore();
      expect(store).toBeDefined();
      expect(typeof store.dispatch).toBe('function');
      expect(typeof store.getState).toBe('function');
      expect(typeof store.subscribe).toBe('function');

      const state = store.getState();
      expect(state).toHaveProperty('candidateApi');
      expect(state).not.toHaveProperty('adminApi');
      expect(state).not.toHaveProperty('companyApi');
    });
  });

  describe('2. Independent Store Instances (Factory Pattern)', () => {
    it('creates independent Admin store instances across multiple calls', () => {
      const store1 = makeAdminStore();
      const store2 = makeAdminStore();

      expect(store1).not.toBe(store2);
      expect(store1.getState()).toEqual(store2.getState());

      let store1Notified = false;
      let store2Notified = false;

      store1.subscribe(() => {
        store1Notified = true;
      });
      store2.subscribe(() => {
        store2Notified = true;
      });

      store1.dispatch({ type: 'TEST_ACTION_ADMIN' });

      expect(store1Notified).toBe(true);
      expect(store2Notified).toBe(false);
    });

    it('creates independent Company store instances across multiple calls', () => {
      const store1 = makeCompanyStore();
      const store2 = makeCompanyStore();

      expect(store1).not.toBe(store2);

      let store1Notified = false;
      let store2Notified = false;

      store1.subscribe(() => {
        store1Notified = true;
      });
      store2.subscribe(() => {
        store2Notified = true;
      });

      store1.dispatch({ type: 'TEST_ACTION_COMPANY' });

      expect(store1Notified).toBe(true);
      expect(store2Notified).toBe(false);
    });

    it('creates independent Candidate store instances across multiple calls', () => {
      const store1 = makeCandidateStore();
      const store2 = makeCandidateStore();

      expect(store1).not.toBe(store2);

      let store1Notified = false;
      let store2Notified = false;

      store1.subscribe(() => {
        store1Notified = true;
      });
      store2.subscribe(() => {
        store2Notified = true;
      });

      store1.dispatch({ type: 'TEST_ACTION_CANDIDATE' });

      expect(store1Notified).toBe(true);
      expect(store2Notified).toBe(false);
    });
  });

  describe('3. Role Store Independence & State Isolation', () => {
    it('ensures Admin, Company, and Candidate stores maintain distinct listener trees and do not cross-talk', () => {
      const adminStore = makeAdminStore();
      const companyStore = makeCompanyStore();
      const candidateStore = makeCandidateStore();

      expect(adminStore.getState()).toHaveProperty('adminApi');
      expect(adminStore.getState()).not.toHaveProperty('companyApi');
      expect(companyStore.getState()).toHaveProperty('companyApi');
      expect(companyStore.getState()).not.toHaveProperty('adminApi');
      expect(candidateStore.getState()).toHaveProperty('candidateApi');
      expect(candidateStore.getState()).not.toHaveProperty('adminApi');

      let adminNotified = false;
      let companyNotified = false;
      let candidateNotified = false;

      adminStore.subscribe(() => {
        adminNotified = true;
      });
      companyStore.subscribe(() => {
        companyNotified = true;
      });
      candidateStore.subscribe(() => {
        candidateNotified = true;
      });

      companyStore.dispatch({ type: 'COMPANY_EVENT' });

      expect(adminNotified).toBe(false);
      expect(companyNotified).toBe(true);
      expect(candidateNotified).toBe(false);
    });
  });
});
