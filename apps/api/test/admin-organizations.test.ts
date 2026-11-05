import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import {
  AdminMetricsDtoSchema,
  PaginatedOrgListDtoSchema,
} from '@hs/contracts';
import { AppModule } from '../src/app.module.js';
import { PG_PLATFORM_POOL, PG_POOL } from '../src/modules/database/database.tokens.js';
import { DatabaseService } from '../src/common/database/database.service.js';
import { SessionService } from '../src/modules/session/session.service.js';
import { APP_CONFIG } from '../src/config/config.tokens.js';
import type { Config } from '../src/config/config.js';

interface MockOrg {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: Date;
  trial_ends_at: Date | null;
}

interface MockUser {
  id: string;
  org_id: string | null;
  email: string;
  role: string;
  status: string;
  deleted_at: Date | null;
}

function createMockDbPool() {
  const futureTrial = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const pastTrial = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  const orgs: MockOrg[] = [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Aster Ridge Inc.',
      slug: 'aster-ridge',
      status: 'paid_active',
      created_at: new Date('2026-09-15T08:00:00.000Z'),
      trial_ends_at: null,
    },
    {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Brindle & Co',
      slug: 'brindle-co',
      status: 'trial_active',
      created_at: new Date('2026-10-01T10:00:00.000Z'),
      trial_ends_at: futureTrial,
    },
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      name: 'Apex Labs',
      slug: 'apex-labs',
      status: 'suspended',
      created_at: new Date('2026-08-01T12:00:00.000Z'),
      trial_ends_at: null,
    },
    {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      name: 'Old Trials Corp',
      slug: 'old-trials',
      status: 'trial_active',
      created_at: new Date('2026-07-01T12:00:00.000Z'),
      trial_ends_at: pastTrial, // Expired trial!
    },
  ];

  const users: MockUser[] = [];
  // 18 active candidates for Aster Ridge + 2 deleted
  for (let i = 0; i < 18; i++) {
    users.push({
      id: `aster-cand-${i}`,
      org_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: `aster_cand_${i}@example.com`,
      role: 'candidate',
      status: 'active',
      deleted_at: null,
    });
  }
  users.push({
    id: 'aster-cand-del-1',
    org_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'deleted1@example.com',
    role: 'candidate',
    status: 'deleted',
    deleted_at: new Date(),
  });
  users.push({
    id: 'aster-cand-del-2',
    org_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'deleted2@example.com',
    role: 'candidate',
    status: 'active',
    deleted_at: new Date(),
  });

  // 24 active candidates for Brindle & Co
  for (let i = 0; i < 24; i++) {
    users.push({
      id: `brindle-cand-${i}`,
      org_id: '00000000-0000-4000-8000-000000000001',
      email: `brindle_cand_${i}@example.com`,
      role: 'candidate',
      status: 'active',
      deleted_at: null,
    });
  }

  // 1 company admin (not candidate)
  users.push({
    id: 'company-admin-1',
    org_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'admin@asterridge.com',
    role: 'company_admin',
    status: 'active',
    deleted_at: null,
  });

  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const q = typeof sql === 'string' ? sql.trim() : '';

      if (q.startsWith('BEGIN') || q.startsWith('COMMIT') || q.startsWith('ROLLBACK')) {
        return { rows: [], rowCount: 0 };
      }

      if (q.includes("set_config('app.is_platform'") || q.includes("set_config('app.org_id'")) {
        return { rows: [], rowCount: 0 };
      }

      // Admin Metrics Query
      if (q.includes('FROM app.organizations) AS total_companies')) {
        const total_companies = orgs.length;
        const now = new Date();
        const active_trials = orgs.filter(
          (o) => o.status === 'trial_active' && o.trial_ends_at !== null && o.trial_ends_at > now,
        ).length;
        const total_candidates = users.filter(
          (u) => u.role === 'candidate' && u.status !== 'deleted' && u.deleted_at === null,
        ).length;

        return {
          rows: [{ total_companies, active_trials, total_candidates }],
          rowCount: 1,
        };
      }

      // Organizations List Count Query
      if (q.includes('SELECT COUNT(*)::int AS total FROM app.organizations o')) {
        let filtered = [...orgs];
        if (params && params.length > 0) {
          // If first param is status
          const firstParam = params[0] as string;
          if (firstParam && !firstParam.startsWith('%')) {
            filtered = filtered.filter((o) => o.status === firstParam);
          }
          // If search param exists
          const searchParam = params.find(
            (p) => typeof p === 'string' && p.startsWith('%') && p.endsWith('%'),
          ) as string | undefined;
          if (searchParam) {
            const raw = searchParam.slice(1, -1).toLowerCase();
            filtered = filtered.filter(
              (o) => o.name.toLowerCase().includes(raw) || o.slug.toLowerCase().includes(raw),
            );
          }
        }
        return { rows: [{ total: filtered.length }], rowCount: 1 };
      }

      // Organizations List Items Query
      if (q.includes('FROM app.organizations o') && q.includes('LEFT JOIN app.entitlements e')) {
        let filtered = [...orgs];
        let pIndex = 0;

        // Check status filter
        if (q.includes('o.status = $')) {
          const statusVal = params?.[pIndex++] as string;
          filtered = filtered.filter((o) => o.status === statusVal);
        }

        // Check search filter
        if (q.includes('o.name ILIKE $')) {
          const searchVal = (params?.[pIndex++] as string).slice(1, -1).toLowerCase();
          filtered = filtered.filter(
            (o) => o.name.toLowerCase().includes(searchVal) || o.slug.toLowerCase().includes(searchVal),
          );
        }

        const pageSize = (params?.[pIndex++] as number) ?? 20;
        const offset = (params?.[pIndex++] as number) ?? 0;

        filtered.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());
        const paged = filtered.slice(offset, offset + pageSize);

        const rows = paged.map((o) => {
          const candidate_count = users.filter(
            (u) =>
              u.org_id === o.id &&
              u.role === 'candidate' &&
              u.status !== 'deleted' &&
              u.deleted_at === null,
          ).length;

          return {
            id: o.id,
            name: o.name,
            slug: o.slug,
            status: o.status,
            created_at: o.created_at,
            trial_ends_at: o.trial_ends_at,
            candidate_count,
          };
        });

        return { rows, rowCount: rows.length };
      }

      return { rows: [], rowCount: 0 };
    }),
    release: vi.fn(),
  };

  return {
    connect: vi.fn(async () => client),
    end: vi.fn(),
    orgs,
    users,
  };
}

describe('S0-T11-2 Admin Organizations List & Metrics API', () => {
  let app: NestFastifyApplication;
  let mockPool: ReturnType<typeof createMockDbPool>;
  let sessionService: SessionService;

  let platformAdminAuth: string;
  let companyAdminAuth: string;
  let candidateAuth: string;

  const testConfig: Config = {
    NODE_ENV: 'development',
    PORT: 4000,
    DATABASE_URL: 'postgres://localhost:5432/hellosmart_test',
    DATABASE_MIGRATOR_URL: 'postgres://localhost:5432/hellosmart_test',
    SESSION_SECRET: 'test_session_secret_at_least_32_characters_long_hello',
    CORS_ORIGINS: ['http://localhost:3000'],
    PAYMENT_GATEWAY: 'fake',
    EMAIL_PROVIDER: 'fake',
    WORKSPACE_RUNTIME: 'fake',
    APP_BASE_URL: 'http://localhost:3000',
    MAILPIT_URL: 'http://127.0.0.1:8025',
  };

  beforeEach(async () => {
    mockPool = createMockDbPool();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(mockPool)
      .overrideProvider(PG_PLATFORM_POOL)
      .useValue(mockPool)
      .overrideProvider(APP_CONFIG)
      .useValue(testConfig)
      .compile();

    app = moduleRef.createNestApplication(new FastifyAdapter());
    app.setGlobalPrefix('api/v1');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    sessionService = app.get(SessionService);
    app.get(DatabaseService).setStatusChecker(async () => ({
      userStatus: 'active',
      orgStatus: 'paid_active',
    }));

    const platformSession = await sessionService.createSession(
      {
        userId: '11111111-1111-4111-8111-111111111111',
        email: 'superadmin@hellosmart.ai',
        role: 'platform_admin',
        orgId: null,
      },
      { mfaVerified: true },
    );
    platformAdminAuth = `hs_session=${platformSession.rawToken}`;

    const companySession = await sessionService.createSession({
      userId: '22222222-2222-4222-8222-222222222222',
      email: 'admin@asterridge.com',
      role: 'company_admin',
      orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    companyAdminAuth = `hs_session=${companySession.rawToken}`;

    const candidateSession = await sessionService.createSession({
      userId: '33333333-3333-4333-8333-333333333333',
      email: 'candidate@example.com',
      role: 'candidate',
      orgId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    });
    candidateAuth = `hs_session=${candidateSession.rawToken}`;
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /admin/organizations (List & Filter)', () => {
    it('1. platform_admin receives paginated organization list with candidate counts and trialEnd dates', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations?page=1&pageSize=20',
        headers: { cookie: platformAdminAuth },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      const validated = PaginatedOrgListDtoSchema.parse(json);
      expect(validated.total).toBe(4);
      expect(validated.page).toBe(1);
      expect(validated.pageSize).toBe(20);
      expect(validated.items.length).toBe(4);

      // Verify Aster Ridge
      const aster = validated.items.find((i) => i.slug === 'aster-ridge');
      expect(aster).toBeDefined();
      expect(aster?.status).toBe('paid_active');
      expect(aster?.candidateCount).toBe(18); // 18 active, excluding 2 deleted
      expect(aster?.trialEndsAt).toBeNull();

      // Verify Brindle & Co
      const brindle = validated.items.find((i) => i.slug === 'brindle-co');
      expect(brindle).toBeDefined();
      expect(brindle?.status).toBe('trial_active');
      expect(brindle?.candidateCount).toBe(24);
      expect(brindle?.trialEndsAt).not.toBeNull();
    });

    it('2. supports status filtering and search query', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations?status=trial_active&search=Brindle',
        headers: { cookie: platformAdminAuth },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      const validated = PaginatedOrgListDtoSchema.parse(json);
      expect(validated.total).toBe(1);
      expect(validated.items.length).toBe(1);
      expect(validated.items[0]?.name).toBe('Brindle & Co');
      expect(validated.items[0]?.status).toBe('trial_active');
    });

    it('3. returns empty list cleanly when search matches nothing', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations?search=NonExistentCompany',
        headers: { cookie: platformAdminAuth },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      const validated = PaginatedOrgListDtoSchema.parse(json);
      expect(validated.total).toBe(0);
      expect(validated.items).toEqual([]);
    });

    it('4. strictly rejects pageSize > 100 with 422 Problem details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations?pageSize=101',
        headers: { cookie: platformAdminAuth },
      });

      expect(res.statusCode).toBe(422);
      expect(res.headers['content-type']).toContain('application/problem+json');
      const json = res.json();
      expect(json.code).toBe('VALIDATION_ERROR');
    });

    it('5. strictly rejects invalid status value with 422 Problem details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations?status=invalid_status',
        headers: { cookie: platformAdminAuth },
      });

      expect(res.statusCode).toBe(422);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('6. rejects unauthenticated access with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations',
      });

      expect(res.statusCode).toBe(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('7. rejects company_admin access with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations',
        headers: { cookie: companyAdminAuth },
      });

      expect(res.statusCode).toBe(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('8. rejects candidate access with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/organizations',
        headers: { cookie: candidateAuth },
      });

      expect(res.statusCode).toBe(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });
  });

  describe('GET /admin/metrics (Overview Metrics)', () => {
    it('1. platform_admin receives accurate aggregated metrics', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/metrics',
        headers: { cookie: platformAdminAuth },
      });

      expect(res.statusCode).toBe(200);
      const json = res.json();
      const validated = AdminMetricsDtoSchema.parse(json);

      expect(validated.totalCompanies).toBe(4);
      // Brindle & Co only (Old Trials Corp trial_ends_at is in the past)
      expect(validated.activeTrials).toBe(1);
      // 18 Aster + 24 Brindle = 42 (excludes 2 deleted candidates & 1 company admin)
      expect(validated.totalCandidates).toBe(42);
    });

    it('2. rejects unauthenticated access with 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/metrics',
      });

      expect(res.statusCode).toBe(401);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('3. rejects company_admin access with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/metrics',
        headers: { cookie: companyAdminAuth },
      });

      expect(res.statusCode).toBe(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('4. rejects candidate access with 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/metrics',
        headers: { cookie: candidateAuth },
      });

      expect(res.statusCode).toBe(403);
      expect(res.headers['content-type']).toContain('application/problem+json');
    });

    it('5. response contains no secret values, hashes, or tokens', async () => {
      const [listRes, metricsRes] = await Promise.all([
        app.inject({
          method: 'GET',
          url: '/api/v1/admin/organizations',
          headers: { cookie: platformAdminAuth },
        }),
        app.inject({
          method: 'GET',
          url: '/api/v1/admin/metrics',
          headers: { cookie: platformAdminAuth },
        }),
      ]);

      const listRaw = listRes.body;
      const metricsRaw = metricsRes.body;

      expect(listRaw).not.toContain('password');
      expect(listRaw).not.toContain('hash');
      expect(listRaw).not.toContain('secret');
      expect(listRaw).not.toContain('token');

      expect(metricsRaw).not.toContain('password');
      expect(metricsRaw).not.toContain('hash');
      expect(metricsRaw).not.toContain('secret');
      expect(metricsRaw).not.toContain('token');
    });
  });
});
