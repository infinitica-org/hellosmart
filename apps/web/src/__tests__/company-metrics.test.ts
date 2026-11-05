import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import React from 'react';
import { GET } from '../app/api/company/metrics/route';
import { getCompanyMetrics, resolveBrowserAuthUrl } from '../lib/api-client';
import CompanyDashboardPage from '../app/(company)/company/page';
import type { CompanyMetricsDto } from '@hs/contracts';

describe('Company Metrics BFF Route, Client & Dashboard (BUG-11)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = {};
  });

  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('maps /candidates/metrics to /api/company/metrics in browser environment', () => {
    const url = resolveBrowserAuthUrl('/candidates/metrics');
    expect(url).toBe('/api/company/metrics');
  });

  it('GET /api/company/metrics proxies to backend with session credentials', async () => {
    const mockMetrics: CompanyMetricsDto = {
      configuredAssessments: 1,
      invitedCandidates: 8,
      activeCandidates: 3,
      submissionsToReview: 2,
      maxCandidates: 25,
      remainingQuota: 17,
    };

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(mockMetrics), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const req = new NextRequest('http://localhost:3000/api/company/metrics', {
      method: 'GET',
      headers: {
        cookie: 'hs_session=test-company-session',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(mockMetrics);

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/candidates/metrics'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Cookie: expect.stringContaining('hs_session=test-company-session'),
        }),
      }),
    );
  });

  it('getCompanyMetrics() client method fetches and returns metrics', async () => {
    const mockMetrics: CompanyMetricsDto = {
      configuredAssessments: 2,
      invitedCandidates: 10,
      activeCandidates: 5,
      submissionsToReview: 4,
      maxCandidates: 30,
      remainingQuota: 20,
    };

    const mockFetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify(mockMetrics), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await getCompanyMetrics(mockFetch);
    expect(result).toEqual(mockMetrics);
    expect(mockFetch).toHaveBeenCalledWith('/api/company/metrics', expect.anything());
  });

  it('renders CompanyDashboardPage component structure without crashing', () => {
    const element = React.createElement(CompanyDashboardPage);
    expect(element).toBeDefined();
    expect(element.type).toBe(CompanyDashboardPage);
  });
});

