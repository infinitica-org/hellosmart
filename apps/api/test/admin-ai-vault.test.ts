import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminAiKeysService, formatMaskedKey } from '../src/modules/admin/admin-ai-keys.service.js';
import { AdminAiKeysController } from '../src/modules/admin/admin-ai-keys.controller.js';
import { CryptoService } from '../src/common/services/crypto.service.js';
import type { Config } from '../src/config/config.js';

function createMockConfig(overrides: Partial<Config> = {}): Config {
  return {
    NODE_ENV: 'test',
    PORT: 4000,
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgres://hs_app:hs_app_local@127.0.0.1:5432/hellosmart',
    DATABASE_MIGRATOR_URL: 'postgres://hs_migrator:hs_migrator_local@127.0.0.1:5432/hellosmart',
    DATABASE_PLATFORM_URL: 'postgres://hs_platform:hs_platform_local@127.0.0.1:5432/hellosmart',
    REDIS_URL: 'redis://127.0.0.1:6379',
    SESSION_SECRET: 'test-secret-test-secret-test-secret-test',
    CORS_ORIGINS: ['http://localhost:3000'],
    PAYMENT_GATEWAY: 'fake',
    EMAIL_PROVIDER: 'fake',
    WORKSPACE_RUNTIME: 'fake',
    APP_BASE_URL: 'http://localhost:3000',
    MAILPIT_URL: 'http://127.0.0.1:8025',
    MFA_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    MFA_ENCRYPTION_KEY_ID: 'k1',
    ...overrides,
  } as Config;
}

describe('AdminAiKeysService & AdminAiKeysController (S1B-T05-2)', () => {
  let cryptoService: CryptoService;
  let mockPool: any;
  let mockClient: any;
  let service: AdminAiKeysService;
  let controller: AdminAiKeysController;
  let queryHistory: Array<{ sql: string; params: any[] }>;

  beforeEach(() => {
    queryHistory = [];
    cryptoService = new CryptoService(createMockConfig());

    mockClient = {
      query: vi.fn(async (sql: string, params: any[] = []) => {
        queryHistory.push({ sql, params });

        // DDL / setup queries
        if (
          sql.includes('CREATE TABLE') ||
          sql.includes('CREATE INDEX') ||
          sql.includes('BEGIN') ||
          sql.includes('COMMIT')
        ) {
          return { rows: [] };
        }

        // 1. Insert platform key
        if (sql.includes('INSERT INTO app.platform_ai_keys')) {
          return {
            rows: [
              {
                id: '11111111-1111-1111-1111-111111111111',
                provider: params[0],
                name: params[1],
                encrypted_key: params[2],
                key_last4: params[3],
                status: 'active',
                is_active: true,
                description: params[4],
                last_tested_at: null,
                created_at: new Date('2026-11-06T12:00:00Z'),
                updated_at: new Date('2026-11-06T12:00:00Z'),
              },
            ],
          };
        }

        // 2. Select platform key for testKey
        if (sql.includes('SELECT id, provider, key_last4, encrypted_key FROM app.platform_ai_keys')) {
          const enc = cryptoService.encrypt('sk-proj-testkeysecret12345678904821');
          return {
            rows: [
              {
                id: '11111111-1111-1111-1111-111111111111',
                provider: 'openai',
                key_last4: '4821',
                encrypted_key: enc,
              },
            ],
          };
        }

        // 3. Select platform key for update/delete (FOR UPDATE)
        if (sql.includes('FROM app.platform_ai_keys WHERE id = $1 FOR UPDATE')) {
          return {
            rows: [
              {
                id: '11111111-1111-1111-1111-111111111111',
                provider: 'openai',
                name: 'Test OpenAI Key',
                key_last4: '4821',
                status: 'active',
                is_active: true,
                description: 'Primary testing key',
                created_at: new Date('2026-11-06T12:00:00Z'),
                updated_at: new Date('2026-11-06T12:00:00Z'),
              },
            ],
          };
        }

        // 4. Update platform key
        if (sql.includes('UPDATE app.platform_ai_keys')) {
          return {
            rows: [
              {
                id: '11111111-1111-1111-1111-111111111111',
                provider: 'openai',
                name: params[0] || 'Updated OpenAI Key',
                key_last4: params[4] || '4821',
                status: params[1] || 'active',
                is_active: params[2] !== undefined ? params[2] : true,
                description: params[3] || 'Rotated key',
                last_tested_at: null,
                created_at: new Date('2026-11-06T12:00:00Z'),
                updated_at: new Date('2026-11-06T12:30:00Z'),
              },
            ],
          };
        }

        // 5. Select platform keys with aggregates
        if (sql.includes('FROM app.platform_ai_keys k')) {
          return {
            rows: [
              {
                id: '11111111-1111-1111-1111-111111111111',
                provider: 'openai',
                name: 'Test OpenAI Key',
                key_last4: '4821',
                status: 'active',
                is_active: true,
                description: 'Primary testing key',
                last_tested_at: null,
                created_at: new Date('2026-11-06T12:00:00Z'),
                updated_at: new Date('2026-11-06T12:00:00Z'),
                total_allocated_cents: 25000,
                active_allocations_count: 2,
              },
            ],
          };
        }

        // 6. Organization existence check
        if (sql.includes('SELECT id, name FROM app.organizations WHERE id = $1')) {
          return {
            rows: [
              {
                id: params[0],
                name: 'Acme Corp',
              },
            ],
          };
        }

        // 7. Key existence check for allocation
        if (sql.includes('SELECT id, name, provider, key_last4, status, is_active FROM app.platform_ai_keys WHERE id = $1')) {
          return {
            rows: [
              {
                id: params[0],
                name: 'Test OpenAI Key',
                provider: 'openai',
                key_last4: '4821',
                status: 'active',
                is_active: true,
              },
            ],
          };
        }

        // 8. Check existing active allocation
        if (sql.includes('SELECT id FROM app.platform_credit_allocations WHERE org_id = $1')) {
          return { rows: [] };
        }

        // 9. Insert credit allocation
        if (sql.includes('INSERT INTO app.platform_credit_allocations')) {
          return {
            rows: [
              {
                id: '22222222-2222-2222-2222-222222222222',
                org_id: params[0],
                platform_key_id: params[1],
                allocated_amount_cents: params[2],
                used_amount_cents: 0,
                balance_cents: params[3],
                markup_percentage: params[4],
                token_cap: params[5],
                spend_cap_cents: params[6],
                status: 'active',
                notes: params[7],
                expires_at: params[8] || null,
                created_at: new Date('2026-11-06T12:00:00Z'),
                updated_at: new Date('2026-11-06T12:00:00Z'),
              },
            ],
          };
        }

        // 10. Select credit allocations
        if (sql.includes('FROM app.platform_credit_allocations a') && !sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                id: '22222222-2222-2222-2222-222222222222',
                org_id: '33333333-3333-3333-3333-333333333333',
                org_name: 'Acme Corp',
                platform_key_id: '11111111-1111-1111-1111-111111111111',
                platform_key_name: 'Test OpenAI Key',
                provider: 'openai',
                key_last4: '4821',
                allocated_amount_cents: 10000,
                used_amount_cents: 2500,
                balance_cents: 7500,
                markup_percentage: 15.0,
                token_cap: null,
                spend_cap_cents: null,
                status: 'active',
                notes: 'Standard plan',
                expires_at: null,
                created_at: new Date('2026-11-06T12:00:00Z'),
                updated_at: new Date('2026-11-06T12:00:00Z'),
              },
            ],
          };
        }

        // 11. Allocation lock query: SELECT ... FOR UPDATE
        if (sql.includes('FROM app.platform_credit_allocations') && sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                id: '22222222-2222-2222-2222-222222222222',
                org_id: '33333333-3333-3333-3333-333333333333',
                org_name: 'Acme Corp',
                platform_key_id: '11111111-1111-1111-1111-111111111111',
                platform_key_name: 'Test OpenAI Key',
                provider: 'openai',
                key_last4: '4821',
                allocated_amount_cents: 10000,
                used_amount_cents: 2500,
                balance_cents: 7500,
                markup_percentage: 15.0,
                token_cap: null,
                spend_cap_cents: null,
                status: 'active',
                notes: 'Standard plan',
                expires_at: null,
                created_at: new Date('2026-11-06T12:00:00Z'),
                updated_at: new Date('2026-11-06T12:00:00Z'),
              },
            ],
          };
        }

        // 12. Allocation update query
        if (sql.includes('UPDATE app.platform_credit_allocations')) {
          return {
            rows: [
              {
                id: '22222222-2222-2222-2222-222222222222',
                org_id: '33333333-3333-3333-3333-333333333333',
                platform_key_id: '11111111-1111-1111-1111-111111111111',
                allocated_amount_cents: params[0],
                used_amount_cents: 2500,
                balance_cents: params[1],
                markup_percentage: params[2],
                status: params[4] || 'active',
                notes: 'Standard plan',
                expires_at: null,
                created_at: new Date('2026-11-06T12:00:00Z'),
                updated_at: new Date('2026-11-06T12:30:00Z'),
              },
            ],
          };
        }

        // 13. Audit event insert
        if (sql.includes('INSERT INTO audit.events')) {
          return { rows: [{ id: 100 }] };
        }

        // 14. Vault stats: keys count
        if (sql.includes('FROM app.platform_ai_keys') && sql.includes('COUNT(*)')) {
          return {
            rows: [
              {
                total_keys: 4,
                active_keys: 3,
              },
            ],
          };
        }

        // 15. Vault stats: allocations count
        if (sql.includes('FROM app.platform_credit_allocations') && sql.includes('COUNT(*)')) {
          return {
            rows: [
              {
                total_allocations: 12,
                total_allocated_cents: 150000,
                total_used_cents: 45000,
                total_remaining_balance_cents: 105000,
              },
            ],
          };
        }

        return { rows: [] };
      }),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn(async () => mockClient),
    };

    service = new AdminAiKeysService(mockPool, cryptoService);
    controller = new AdminAiKeysController(service);
  });

  describe('Key Masking Invariants', () => {
    it('correctly masks OpenAI keys', () => {
      expect(formatMaskedKey('openai', '4821')).toBe('sk-...4821');
    });

    it('correctly masks Anthropic keys', () => {
      expect(formatMaskedKey('anthropic', '9102')).toBe('sk-ant-...9102');
    });

    it('correctly masks Google Gemini keys', () => {
      expect(formatMaskedKey('gemini', '7731')).toBe('AIza...7731');
    });

    it('correctly masks DeepSeek keys', () => {
      expect(formatMaskedKey('deepseek', '3321')).toBe('sk-ds-...3321');
    });
  });

  describe('Platform Key Vault Operations (AD-023 / BR-16)', () => {
    const actor = { userId: 'usr_admin1', role: 'platform_admin' };
    const meta = { ip: '127.0.0.1', userAgent: 'test-agent', requestId: 'req_1' };

    it('creates and vaults platform key with AES-256-GCM envelope encryption and zero secret leak', async () => {
      const rawSecret = 'sk-proj-supersecretapikey12345678904821';
      const result = await service.createKey(
        {
          provider: 'openai',
          name: 'Production OpenAI Key',
          apiKey: rawSecret,
          description: 'Production cluster',
        },
        actor,
        meta,
      );

      // Verify returned DTO does NOT contain raw secret
      expect((result as any).apiKey).toBeUndefined();
      expect((result as any).key_ciphertext).toBeUndefined();
      expect(result.maskedKey).toBe('sk-...4821');
      expect(result.keyLast4).toBe('4821');
      expect(result.name).toBe('Production OpenAI Key');

      // Verify the ciphertext passed to database query starts with AES-256-GCM envelope prefix
      const insertQuery = queryHistory.find((q) => q.sql.includes('INSERT INTO app.platform_ai_keys'));
      expect(insertQuery).toBeDefined();
      const storedCiphertext = insertQuery!.params[2];
      expect(storedCiphertext.startsWith('enc:v1:')).toBe(true);

      // Verify that decrypting the stored ciphertext recovers the original secret
      const decrypted = cryptoService.decrypt(storedCiphertext);
      expect(decrypted).toBe(rawSecret);

      // Verify audit event was emitted with zero secret leakage
      const auditQuery = queryHistory.find(
        (q) => q.sql.includes('INSERT INTO audit.events') && q.params.includes('ai_key.created'),
      );
      expect(auditQuery).toBeDefined();
      // Ensure raw secret or ciphertext was never included in audit payload
      const auditPayloadStr = JSON.stringify(auditQuery!.params);
      expect(auditPayloadStr.includes(rawSecret)).toBe(false);
      expect(auditPayloadStr.includes('enc:v1:')).toBe(false);
    });

    it('rotates platform key and records audit trail', async () => {
      const newSecret = 'sk-proj-newrotatedsecret12345678909999';
      const result = await service.updateKey(
        '11111111-1111-1111-1111-111111111111',
        {
          name: 'Updated OpenAI Key',
          apiKey: newSecret,
        },
        actor,
        meta,
      );

      expect(result.keyLast4).toBe('9999');
      expect(result.maskedKey).toBe('sk-...9999');

      // Check audit event
      const rotateAudit = queryHistory.find(
        (q) => q.sql.includes('INSERT INTO audit.events') && q.params.includes('ai_key.rotated'),
      );
      expect(rotateAudit).toBeDefined();
    });

    it('revokes platform key and logs action (AD-023, BR-16, F-06)', async () => {
      const result = await service.deleteKey('11111111-1111-1111-1111-111111111111', actor, meta);
      expect(result.status).toBe('revoked');
      expect(result.success).toBe(true);

      const revokeAudit = queryHistory.find(
        (q) => q.sql.includes('INSERT INTO audit.events') && q.params.includes('ai_key.revoked'),
      );
      expect(revokeAudit).toBeDefined();
    });

    it('verifies platform key envelope decryption without provider network calls (F-02)', async () => {
      const testResult = await service.testKey('11111111-1111-1111-1111-111111111111');
      expect(testResult.success).toBe(true);
      expect(testResult.message).toBe('Cryptographic envelope and decryption verified successfully.');
      expect(testResult.provider).toBe('openai');
      expect(testResult.last4).toBe('4821');
    });

    it('rejects tampered or corrupted envelope during verification with KEY_AUTH_FAILED (F-02)', async () => {
      mockClient.query = vi.fn(async (sql: string, params: any[] = []) => {
        if (sql.includes('SELECT id, provider, key_last4, encrypted_key FROM app.platform_ai_keys')) {
          return {
            rows: [
              {
                id: '11111111-1111-1111-1111-111111111111',
                provider: 'openai',
                key_last4: '4821',
                encrypted_key: 'enc:v1:k1:invalidiv:invalidtag:corruptciphertext',
              },
            ],
          };
        }
        return { rows: [] };
      });

      await expect(service.testKey('11111111-1111-1111-1111-111111111111')).rejects.toThrow();
    });

    it('never executes runtime DDL (CREATE TABLE / CREATE INDEX) during API requests (F-01)', async () => {
      queryHistory = [];
      await service.listKeys();
      const hasDdl = queryHistory.some(
        (q) => q.sql.includes('CREATE TABLE') || q.sql.includes('CREATE INDEX'),
      );
      expect(hasDdl).toBe(false);
    });
  });

  describe('Credit Allocation Operations (AD-024 / BR-17)', () => {
    const actor = { userId: 'usr_admin1', role: 'platform_admin' };
    const meta = { ip: '127.0.0.1', userAgent: 'test-agent', requestId: 'req_1' };

    it('allocates managed credits to tenant organization and writes audit event', async () => {
      const result = await service.createAllocation(
        {
          orgId: '33333333-3333-3333-3333-333333333333',
          platformKeyId: '11111111-1111-1111-1111-111111111111',
          allocatedAmountCents: 10000, // $100.00
          markupPercentage: 15.0,
          notes: 'Standard plan credits',
        },
        actor,
        meta,
      );

      expect(result.allocatedAmountCents).toBe(10000);
      expect(result.balanceCents).toBe(10000);
      expect(result.markupPercentage).toBe(15.0);
      expect(result.status).toBe('active');

      const auditQuery = queryHistory.find(
        (q) => q.sql.includes('INSERT INTO audit.events') && q.params.includes('ai_allocation.created'),
      );
      expect(auditQuery).toBeDefined();
    });

    it('adjusts credit allocation with FOR UPDATE row locking and enforces non-negative balance invariant', async () => {
      // 1. Positive adjustment (adding $50.00 = +5000 cents)
      const adjusted = await service.adjustAllocation(
        '22222222-2222-2222-2222-222222222222',
        {
          adjustmentAmountCents: 5000,
          reason: 'Customer added $50 top-up',
        },
        actor,
        meta,
      );

      // Verify FOR UPDATE locking query was executed
      const lockQuery = queryHistory.find((q) => q.sql.includes('FOR UPDATE'));
      expect(lockQuery).toBeDefined();

      expect(adjusted.allocatedAmountCents).toBe(15000);
      expect(adjusted.balanceCents).toBe(12500); // 15000 - 2500 used

      // 2. Negative adjustment that would result in negative balance must be rejected
      try {
        await service.adjustAllocation(
          '22222222-2222-2222-2222-222222222222',
          {
            adjustmentAmountCents: -9000, // Current used is 2500, new total would be 1000, balance -1500!
            reason: 'Excessive clawback',
          },
          actor,
          meta,
        );
        expect.unreachable('Should have thrown 422');
      } catch (err: any) {
        expect(err.getStatus?.()).toBe(422);
        expect(err.getResponse?.().code).toBe('INSUFFICIENT_CREDIT_BALANCE');
      }
    });

    it('revokes credit allocation and logs audit entry', async () => {
      const revoked = await service.revokeAllocation(
        '22222222-2222-2222-2222-222222222222',
        'Customer subscription cancelled',
        actor,
        meta,
      );

      expect(revoked.status).toBe('revoked');

      const auditQuery = queryHistory.find(
        (q) => q.sql.includes('INSERT INTO audit.events') && q.params.includes('ai_allocation.revoked'),
      );
      expect(auditQuery).toBeDefined();
    });

    it('computes overview metrics for vault stats', async () => {
      const stats = await service.getVaultStats();
      expect(stats.totalKeys).toBe(4);
      expect(stats.activeKeys).toBe(3);
      expect(stats.totalAllocations).toBe(12);
      expect(stats.totalAllocatedCents).toBe(150000);
      expect(stats.totalUsedCents).toBe(45000);
      expect(stats.totalRemainingBalanceCents).toBe(105000);
    });
  });

  describe('AdminAiKeysController RBAC & Validation', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const unauthReq: any = { headers: {} };

      try {
        await controller.createKey({ provider: 'openai', name: 'Key', apiKey: 'sk-test12345678' }, unauthReq);
        expect.unreachable('Should have thrown 401');
      } catch (err: any) {
        expect(err.getStatus?.()).toBe(401);
        expect(err.getResponse?.().title).toBe('Unauthorized');
      }

      try {
        await controller.createAllocation(
          {
            orgId: '33333333-3333-3333-3333-333333333333',
            platformKeyId: '11111111-1111-1111-1111-111111111111',
            allocatedAmountCents: 1000,
          },
          unauthReq,
        );
        expect.unreachable('Should have thrown 401');
      } catch (err: any) {
        expect(err.getStatus?.()).toBe(401);
        expect(err.getResponse?.().title).toBe('Unauthorized');
      }
    });

    it('rejects invalid payload schemas with 422 Problem Details', async () => {
      const authReq: any = {
        user: { userId: 'usr_admin', role: 'platform_admin' },
        headers: {},
      };

      try {
        await controller.createKey({ provider: 'openai', name: 'A', apiKey: 'short' }, authReq);
        expect.unreachable('Should have thrown 422');
      } catch (err: any) {
        expect(err.getStatus?.()).toBe(422);
        expect(err.getResponse?.().title).toBe('Validation Error');
      }
    });
  });
});
