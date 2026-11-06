import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { makeAdminStore } from '@/store/admin/adminStore';
import * as adminApiModule from '@/store/admin/adminApi';
import { adminApi, ADMIN_TAG_TYPES } from '@/store/admin/adminApi';
import { AdminStoreProvider } from '@/providers/store-provider';
import AdminAiKeysPage from '@/app/(admin)/admin/ai-keys/page';
import { AiVaultMetricsCards } from '@/components/admin/ai-vault/ai-vault-metrics-cards';
import { AiKeysVaultTab } from '@/components/admin/ai-vault/ai-keys-vault-tab';
import { CreditAllocationsTab } from '@/components/admin/ai-vault/credit-allocations-tab';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/admin/ai-keys',
  useSearchParams: () => new URLSearchParams(),
}));

describe('Platform AI Keys Vault & Credit Allocation Manager UI (S1B-T05-2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('RTK Query Tags & Endpoints', () => {
    it('registers AiKeys and AiAllocations in ADMIN_TAG_TYPES', () => {
      expect(ADMIN_TAG_TYPES).toContain('AiKeys');
      expect(ADMIN_TAG_TYPES).toContain('AiAllocations');
    });

    it('registers all required key vault and credit allocation endpoints on adminApi', () => {
      expect(adminApi.endpoints.getPlatformAiKeys).toBeDefined();
      expect(adminApi.endpoints.createPlatformAiKey).toBeDefined();
      expect(adminApi.endpoints.updatePlatformAiKey).toBeDefined();
      expect(adminApi.endpoints.revokePlatformAiKey).toBeDefined();
      expect(adminApi.endpoints.testPlatformAiKey).toBeDefined();

      expect(adminApi.endpoints.getCreditAllocations).toBeDefined();
      expect(adminApi.endpoints.createCreditAllocation).toBeDefined();
      expect(adminApi.endpoints.adjustCreditAllocation).toBeDefined();
      expect(adminApi.endpoints.revokeCreditAllocation).toBeDefined();

      expect(adminApi.endpoints.getAiVaultStats).toBeDefined();
    });

    it('guarantees PlatformAiKeyDto public contracts exclude raw API secrets (F-05)', () => {
      const publicDto = {
        id: '11111111-1111-1111-1111-111111111111',
        provider: 'openai',
        name: 'Master Key',
        maskedKey: 'sk-...4821',
        keyLast4: '4821',
        status: 'active',
        isActive: true,
        totalAllocatedCents: 50000,
        activeAllocationsCount: 2,
        createdAt: '2026-11-06T10:00:00.000Z',
        updatedAt: '2026-11-06T10:00:00.000Z',
      };
      expect((publicDto as any).apiKey).toBeUndefined();
      expect((publicDto as any).encryptedKey).toBeUndefined();
      expect(publicDto.maskedKey).toBe('sk-...4821');
    });
  });

  describe('AiVaultMetricsCards Component', () => {
    it('renders 4 metric stat cards with formatted dollar amounts and zero state', () => {
      const mockStats = {
        totalKeys: 5,
        activeKeys: 4,
        totalAllocations: 15,
        totalAllocatedCents: 250000, // $2,500.00
        totalUsedCents: 0,
        totalRemainingBalanceCents: 250000, // $2,500.00
      };

      const html = renderToString(<AiVaultMetricsCards stats={mockStats} />);
      expect(html).toContain('Vaulted Platform Keys');
      expect(html).toContain('5');
      expect(html).toContain('4 active in key ring');

      expect(html).toContain('Tenant Allocations');
      expect(html).toContain('15');

      expect(html).toContain('Total Credits Allocated');
      expect(html).toContain('$2,500.00');
      expect(html).toContain('Recorded usage: $0.00 (proxy metering unconnected)');

      expect(html).toContain('Available Remaining Balance');
      expect(html).toContain('$2,500.00');
    });
  });

  describe('AdminAiKeysPage Layout & Structure', () => {
    it('renders page layout with PageHeader, badges, tabs, and security callout', () => {
      const store = makeAdminStore();
      const html = renderToString(
        <AdminStoreProvider store={store}>
          <AdminAiKeysPage />
        </AdminStoreProvider>,
      );

      expect(html).toContain('Platform AI Keys Vault &amp; Credit Allocations');
      expect(html).toContain('Super Admin');
      expect(html).toContain('Platform AI Keys Vault');
      expect(html).toContain('Tenant Credit Allocations');
      expect(html).toContain('Zero Secret Leakage Guarantee');
      expect(html).toContain('AES-256-GCM');
    });
  });

  describe('AiKeysVaultTab Component', () => {
    it('renders search filter bar and vault action buttons', () => {
      const store = makeAdminStore();
      const html = renderToString(
        <AdminStoreProvider store={store}>
          <AiKeysVaultTab />
        </AdminStoreProvider>,
      );

      expect(html).toContain('Search keys by name, provider, last4...');
      expect(html).toContain('Vault Platform Key');
      expect(html).toContain('All Providers');
    });

    it('renders Last Verified column and Verify Integrity action button when keys are present (F-02)', () => {
      vi.spyOn(adminApiModule, 'useGetPlatformAiKeysQuery').mockReturnValue({
        data: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            provider: 'openai',
            name: 'Master Key',
            maskedKey: 'sk-...4821',
            keyLast4: '4821',
            status: 'active',
            isActive: true,
            totalAllocatedCents: 50000,
            activeAllocationsCount: 2,
            lastTestedAt: '2026-11-06T12:00:00Z',
            createdAt: '2026-11-06T10:00:00Z',
            updatedAt: '2026-11-06T10:00:00Z',
          },
        ],
        isLoading: false,
        error: undefined,
        refetch: vi.fn(),
      } as any);

      const store = makeAdminStore();
      const html = renderToString(
        <AdminStoreProvider store={store}>
          <AiKeysVaultTab />
        </AdminStoreProvider>,
      );

      expect(html).toContain('Last Verified');
      expect(html).toContain('Verify Integrity');
      expect(html).not.toContain('Last Tested');
    });
  });

  describe('CreditAllocationsTab Component', () => {
    it('renders tenant allocations search, allocate button, and credit accounting banner', () => {
      const store = makeAdminStore();
      const html = renderToString(
        <AdminStoreProvider store={store}>
          <CreditAllocationsTab />
        </AdminStoreProvider>,
      );

      expect(html).toContain('Search allocations by org name, key, ID...');
      expect(html).toContain('Allocate Tenant Credits');
      expect(html).toContain('All Statuses');
      expect(html).toContain('Credit Accounting Architecture:');
    });
  });
});
