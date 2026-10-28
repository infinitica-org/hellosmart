import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOrganizations,
  getMetrics,
  createOrganization,
  updateOrganizationStatus,
  resetOrganizationsStore,
} from '../lib/organizations-data';
import { GET, POST, PATCH } from '../app/api/admin/organizations/route';
import { NextRequest } from 'next/server';

describe('Super Admin Organization Provisioning & Management (Zero Dummy Data)', () => {
  beforeEach(() => {
    resetOrganizationsStore();
  });

  it('starts with zero companies and zero metrics', () => {
    const orgs = getOrganizations();
    const metrics = getMetrics();

    expect(orgs.length).toBe(0);
    expect(metrics.totalCompanies).toBe(0);
    expect(metrics.activeTrials).toBe(0);
    expect(metrics.totalCandidates).toBe(0);
  });

  it('provisions a new company and dynamically updates metrics', () => {
    const newOrg = createOrganization({
      name: 'Vercel Enterprises',
      slug: 'vercel-enterprises',
      adminEmail: 'admin@vercel.com',
      adminName: 'Guillermo Rauch',
      plan: 'pro',
      maxTemplates: 20,
      maxCandidates: 150,
      trialDays: 30,
    });

    expect(newOrg.slug).toBe('vercel-enterprises');
    expect(newOrg.status).toBe('active'); // Pro plan starts active
    expect(newOrg.maxCandidates).toBe(150);

    const updatedMetrics = getMetrics();
    expect(updatedMetrics.totalCompanies).toBe(1);
    expect(updatedMetrics.activeTrials).toBe(0);
    expect(updatedMetrics.totalCandidates).toBe(0);
  });

  it('provisions a trial company and sets status to trial', () => {
    const newOrg = createOrganization({
      name: 'Startup AI',
      slug: 'startup-ai',
      adminEmail: 'founder@startup.ai',
      adminName: 'Alice Smith',
      plan: 'trial',
      maxTemplates: 3,
      maxCandidates: 10,
      trialDays: 14,
    });

    expect(newOrg.status).toBe('trial');
    const updatedMetrics = getMetrics();
    expect(updatedMetrics.totalCompanies).toBe(1);
    expect(updatedMetrics.activeTrials).toBe(1);
  });

  it('enforces slug uniqueness on organization creation', () => {
    createOrganization({
      name: 'First Company',
      slug: 'acme-global',
      adminEmail: 'first@acme.com',
      adminName: 'Alice',
      plan: 'trial',
      maxTemplates: 5,
      maxCandidates: 25,
      trialDays: 14,
    });

    expect(() => {
      createOrganization({
        name: 'Duplicate Company',
        slug: 'acme-global',
        adminEmail: 'second@acme.com',
        adminName: 'Bob',
        plan: 'trial',
        maxTemplates: 5,
        maxCandidates: 25,
        trialDays: 14,
      });
    }).toThrow(/already exists/);
  });

  it('suspends and reinstates an organization', () => {
    createOrganization({
      name: 'Acme Global',
      slug: 'acme-global',
      adminEmail: 'admin@acme.com',
      adminName: 'Sarah',
      plan: 'trial',
      maxTemplates: 5,
      maxCandidates: 25,
      trialDays: 14,
    });

    const suspended = updateOrganizationStatus('acme-global', 'suspended');
    expect(suspended.status).toBe('suspended');

    const metricsAfterSuspend = getMetrics();
    expect(metricsAfterSuspend.activeTrials).toBe(0);

    const reinstated = updateOrganizationStatus('acme-global', 'active');
    expect(reinstated.status).toBe('active');
  });

  it('handles GET API request returning empty array when no organizations exist', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.organizations).toHaveLength(0);
    expect(data.metrics.totalCompanies).toBe(0);
    expect(data.metrics.activeTrials).toBe(0);
  });

  it('handles POST API request creating a company', async () => {
    const req = new NextRequest('http://localhost:3000/api/admin/organizations', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Supabase Systems',
        slug: 'supabase-systems',
        adminEmail: 'admin@supabase.io',
        adminName: 'Paul Copplestone',
        plan: 'pro',
        maxTemplates: 10,
        maxCandidates: 50,
        trialDays: 30,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.organization.name).toBe('Supabase Systems');
  });

  it('handles PATCH API request updating organization status', async () => {
    createOrganization({
      name: 'Stripe Atlas',
      slug: 'stripe-atlas',
      adminEmail: 'admin@stripe.com',
      adminName: 'David',
      plan: 'pro',
      maxTemplates: 10,
      maxCandidates: 50,
      trialDays: 30,
    });

    const req = new NextRequest('http://localhost:3000/api/admin/organizations', {
      method: 'PATCH',
      body: JSON.stringify({
        id: 'stripe-atlas',
        status: 'suspended',
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.organization.status).toBe('suspended');
  });
});
