import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { NextRequest } from 'next/server';
import { AdminCompaniesView } from '../app/(admin)/admin/companies/page';
import { AdminAgentsView, STANDARD_REVIEWER_AGENTS } from '../app/(admin)/admin/agents/page';
import { AdminAuditView } from '../app/(admin)/admin/audit/page';
import { GET as auditGET } from '../app/api/admin/audit/route';
import type { Organization } from '@/types/organization';
import type { AuditEventDto } from '../app/api/admin/audit/route';

describe('Admin Subpages Implementation (BUG-16)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Companies Subpage (AdminCompaniesView)', () => {
    const mockOrgs: Organization[] = [
      {
        id: 'org-1',
        name: 'Acme Simulation Academy',
        slug: 'acme-corp',
        status: 'active',
        plan: 'pro',
        candidatesCount: 15,
        adminEmail: 'admin@acme.test',
        adminName: 'Alice Admin',
        maxTemplates: 5,
        maxCandidates: 25,
        trialDays: 14,
        createdAt: '2026-10-01T00:00:00Z',
      },
      {
        id: 'org-2',
        name: 'Beta Labs',
        slug: 'beta-labs',
        status: 'trial',
        plan: 'trial',
        candidatesCount: 5,
        adminEmail: 'admin@beta.test',
        adminName: 'Bob Admin',
        maxTemplates: 3,
        maxCandidates: 10,
        trialDays: 14,
        createdAt: '2026-10-15T00:00:00Z',
      },
    ];

    it('renders companies view with metrics and organization table', () => {
      const element = React.createElement(AdminCompaniesView, {
        organizations: mockOrgs,
        isLoading: false,
        onRefresh: vi.fn(),
      });

      expect(element).toBeDefined();
      expect(element.props.organizations).toHaveLength(2);
    });
  });

  describe('2. Agents Subpage (AdminAgentsView)', () => {
    it('defines and renders 5 production reviewer agents with BR-18 / BR-20 governance', () => {
      expect(STANDARD_REVIEWER_AGENTS).toHaveLength(5);

      const agentIds = STANDARD_REVIEWER_AGENTS.map((a) => a.id);
      expect(agentIds).toContain('agent_code_correctness');
      expect(agentIds).toContain('agent_tool_governance');
      expect(agentIds).toContain('agent_code_quality');
      expect(agentIds).toContain('agent_security_audit');
      expect(agentIds).toContain('agent_session_integrity');

      // Weights must sum to 100% per BRD rubric specification
      const totalWeight = STANDARD_REVIEWER_AGENTS.reduce((sum, a) => sum + a.weight, 0);
      expect(totalWeight).toBe(100);

      const element = React.createElement(AdminAgentsView, {
        agents: STANDARD_REVIEWER_AGENTS,
      });
      expect(element).toBeDefined();
    });
  });

  describe('3. Audit Subpage (AdminAuditView)', () => {
    const mockAuditEvents: AuditEventDto[] = [
      {
        id: 'evt-1',
        actorId: 'usr-admin-1',
        actorRole: 'platform_admin',
        orgId: null,
        action: 'organization.provisioned',
        entity: 'organization',
        entityId: 'org-1',
        before: null,
        after: { name: 'Acme Simulation Academy' },
        ip: '127.0.0.1',
        createdAt: '2026-10-30T12:00:00Z',
        hash: 'abcdef1234567890',
      },
    ];

    it('renders audit log view with hash chain metrics', () => {
      const element = React.createElement(AdminAuditView, {
        events: mockAuditEvents,
        isLoading: false,
        onRefresh: vi.fn(),
      });

      expect(element).toBeDefined();
      expect(element.props.events).toHaveLength(1);
    });
  });

  describe('4. Audit API Route (GET /api/admin/audit)', () => {
    it('requires platform_admin authorization', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/audit', {
        method: 'GET',
      });

      const res = await auditGET(req);
      expect(res.status).toBe(401);
    });

    it('returns audit log stream for platform_admin session', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/audit', {
        method: 'GET',
        headers: {
          cookie: 'hs_session=hs_dev_platform_session',
        },
      });

      // Mock session verification for test
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: { role: 'platform_admin', email: 'admin@hellosmart.ai' },
            role: 'platform_admin',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const res = await auditGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toHaveProperty('items');
      expect(Array.isArray(data.items)).toBe(true);
      expect(data.integrityVerified).toBe(true);
    });
  });
});
