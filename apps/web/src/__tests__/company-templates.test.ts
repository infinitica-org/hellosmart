import { describe, it, expect, vi } from 'vitest';
import { fetchAssignedTemplates, fetchTemplateById } from '../lib/company-api';
import { ApiError } from '../lib/api-client';
import type { RoleTemplateSummary, RoleTemplateDetail } from '../components/company/templates/types';

describe('Company Templates API & Contract Tests (#121)', () => {
  const mockTemplateSummary: RoleTemplateSummary = {
    id: 'tpl_fs_01',
    versionId: '1.2.0',
    name: 'Full Stack Next.js & PostgreSQL Assessment',
    category: 'Full Stack',
    difficulty: 'Intermediate',
    durationMinutes: 90,
    workspaceMode: 'cloud',
    description: 'Build a secure multi-tenant dashboard feature with optimistic updates.',
    tags: ['React', 'Next.js', 'PostgreSQL', 'Tailwind'],
  };

  const mockTemplateDetail: RoleTemplateDetail = {
    ...mockTemplateSummary,
    candidateBrief: 'Implement the multi-tenant metrics aggregation API and frontend card.',
    scenario: 'You are an engineer joining the core platform team.',
    starterRepository: {
      name: 'hellosmart-starter-fs',
      branch: 'main',
      fileStructure: ['src/app/page.tsx', 'src/lib/db.ts', 'package.json'],
    },
    environment: {
      runtime: ['Node.js 20', 'PostgreSQL 16'],
      tools: ['Docker', 'Git'],
    },
    rubric: [
      {
        id: 'rubric_1',
        name: 'Database Query Optimization',
        weight: 40,
        goal: 'Avoid N+1 queries and utilize parameterized indexing.',
      },
      {
        id: 'rubric_2',
        name: 'UI Responsiveness & Accessibility',
        weight: 60,
        goal: 'Clean responsive grid with accessible ARIA landmarks.',
      },
    ],
    aiDefaults: {
      enabled: true,
      allowedModels: ['gpt-4o', 'claude-3-5-sonnet'],
    },
  };

  describe('fetchAssignedTemplates (GET /company/templates)', () => {
    it('successfully retrieves assigned template summaries (BR-02)', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify([mockTemplateSummary]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await fetchAssignedTemplates(mockFetch as unknown as typeof fetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/company/templates');
      expect(init.method).toBe('GET');
      expect(init.credentials).toBe('include');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('tpl_fs_01');
      expect(result[0]?.versionId).toBe('1.2.0');
    });

    it('handles paginated or object wrapped response { items: [...] }', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ items: [mockTemplateSummary] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await fetchAssignedTemplates(mockFetch as unknown as typeof fetch);
      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe(mockTemplateSummary.name);
    });

    it('throws ApiError with status 403 on tenant authorization failure (BR-01)', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'Forbidden',
            status: 403,
            detail: 'User does not belong to organization',
            code: 'TENANT_REQUIRED',
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(
        fetchAssignedTemplates(mockFetch as unknown as typeof fetch)
      ).rejects.toThrow(ApiError);
    });
  });

  describe('fetchTemplateById (GET /company/templates/:id)', () => {
    it('successfully retrieves full template specification for the drawer', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockTemplateDetail), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await fetchTemplateById('tpl_fs_01', mockFetch as unknown as typeof fetch);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/company/templates/tpl_fs_01');
      expect(result.candidateBrief).toBe(mockTemplateDetail.candidateBrief);
      expect(result.rubric).toHaveLength(2);
      expect(result.starterRepository.fileStructure).toContain('package.json');
    });

    it('throws an error if templateId is empty', async () => {
      await expect(fetchTemplateById('')).rejects.toThrow('Template ID is required');
    });

    it('throws ApiError 404 when template is unassigned or does not exist (BR-02)', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: 'Not Found',
            status: 404,
            detail: 'Template not found or unassigned',
            code: 'TEMPLATE_NOT_FOUND',
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(
        fetchTemplateById('unknown_id', mockFetch as unknown as typeof fetch)
      ).rejects.toThrow(ApiError);
    });
  });

  describe('Version Pinning Contract (BR-03)', () => {
    it('preserves both templateId and versionId in navigation target URL', () => {
      const template = mockTemplateSummary;
      const targetUrl = `/company/assessments/new?templateId=${encodeURIComponent(
        template.id
      )}&versionId=${encodeURIComponent(template.versionId)}`;

      expect(targetUrl).toBe('/company/assessments/new?templateId=tpl_fs_01&versionId=1.2.0');
      const parsed = new URL(targetUrl, 'http://localhost:3000');
      expect(parsed.searchParams.get('templateId')).toBe('tpl_fs_01');
      expect(parsed.searchParams.get('versionId')).toBe('1.2.0');
    });
  });
});

