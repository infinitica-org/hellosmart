/**
 * All supported route prefixes for candidates management.
 * CandidatesController is registered with both '/candidates' and '/company/candidates'.
 * Putting this in a single constant array allows future removal of the alias in one line.
 */
export const CANDIDATE_ROUTE_PREFIXES = [
  {
    prefix: '/company/candidates',
    isAlias: false,
    description: 'standard company candidates route',
  },
  {
    prefix: '/candidates',
    isAlias: true,
    description: 'deprecated alias (recommended removal, to be confirmed by Vishal V)',
  },
] as const;

import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export type RouteAccessCategory =
  | 'public'
  | 'platform_admin'
  | 'company_admin'
  | 'candidate'
  | 'authenticated';

export interface RouteEntry {
  method: string;
  url: string;
  category: RouteAccessCategory;
  description: string;
}

/**
 * Authoritative security route matrix for all expected API routes.
 * Every route registered in Fastify MUST match an entry here, or the matrix validation will fail.
 */
export const EXPECTED_ROUTE_MATRIX: Record<
  string,
  { category: RouteAccessCategory; description: string }
> = {
  // Public Routes (No authentication required)
  'GET /api/v1/health': { category: 'public', description: 'Basic liveness health probe' },
  'GET /api/v1/health/ready': { category: 'public', description: 'Readiness probe' },
  'POST /api/v1/auth/login': { category: 'public', description: 'User authentication endpoint' },
  'POST /api/v1/auth/identify': {
    category: 'public',
    description: 'Check auth identifier existence',
  },
  'GET /api/v1/auth/invitations/:token': {
    category: 'public',
    description: 'Validate invitation token',
  },
  'POST /api/v1/auth/invitations/accept': {
    category: 'public',
    description: 'Accept invitation and set password',
  },
  'POST /api/v1/auth/mfa/verify': {
    category: 'public',
    description: 'Verify 2FA TOTP or backup code during login',
  },
  'GET /api/v1/storage/download': {
    category: 'public',
    description: 'Signed HMAC token download stream for deliverables',
  },

  // Authenticated User Routes (Open to all authenticated roles: platform_admin, company_admin, candidate)
  'GET /api/v1/me': {
    category: 'authenticated',
    description: 'Current authenticated user profile',
  },
  'POST /api/v1/auth/logout': {
    category: 'authenticated',
    description: 'Logout current user session',
  },
  'POST /api/v1/auth/logout-all': {
    category: 'authenticated',
    description: 'Revoke all sessions for current user',
  },
  'POST /api/v1/auth/password/change': {
    category: 'authenticated',
    description: 'Change user password with history enforcement',
  },
  'GET /api/v1/auth/sessions': {
    category: 'authenticated',
    description: 'List active sessions for current user',
  },
  'DELETE /api/v1/auth/sessions/:id': {
    category: 'authenticated',
    description: 'Revoke a specific user session',
  },

  // Platform Admin Exclusive Routes
  'GET /api/v1/admin/organizations': {
    category: 'platform_admin',
    description: 'List organizations in platform admin console',
  },
  'POST /api/v1/admin/organizations': {
    category: 'platform_admin',
    description: 'Provision a new customer organization',
  },
  'PATCH /api/v1/admin/organizations/:id/status': {
    category: 'platform_admin',
    description: 'Suspend or activate organization',
  },
  'GET /api/v1/admin/metrics': {
    category: 'platform_admin',
    description: 'Platform-wide operational telemetry and analytics',
  },
  'GET /api/v1/admin/templates': {
    category: 'platform_admin',
    description: 'Master platform assessment template catalog',
  },
  'POST /api/v1/admin/templates': {
    category: 'platform_admin',
    description: 'Create new master assessment template',
  },
  'POST /api/v1/admin/templates/:id/clone': {
    category: 'platform_admin',
    description: 'Clone template into a new blueprint',
  },
  'POST /api/v1/admin/templates/:id/versions/:version/publish': {
    category: 'platform_admin',
    description: 'Publish and freeze a template version',
  },
  'POST /api/v1/admin/templates/:id/assign': {
    category: 'platform_admin',
    description: 'Assign template to an organization',
  },
  'POST /api/v1/admin/templates/:id/assign/bulk': {
    category: 'platform_admin',
    description: 'Bulk assign template to multiple organizations',
  },
  'DELETE /api/v1/admin/templates/:id/assign/:orgId': {
    category: 'platform_admin',
    description: 'Revoke template assignment from an organization',
  },
  'GET /api/v1/auth/mfa/status': {
    category: 'platform_admin',
    description: 'Check platform admin MFA enrollment status',
  },
  'POST /api/v1/auth/mfa/setup/start': {
    category: 'platform_admin',
    description: 'Initiate TOTP enrollment secret generation',
  },
  'POST /api/v1/auth/mfa/setup/confirm': {
    category: 'platform_admin',
    description: 'Confirm TOTP enrollment with first token',
  },
  'POST /api/v1/auth/mfa/backup-codes/regenerate': {
    category: 'platform_admin',
    description: 'Regenerate MFA backup recovery codes',
  },

  // Dev & Test Routes (Conditioned on NODE_ENV !== production)
  'GET /api/v1/_test/org/:orgId/ping': {
    category: 'authenticated',
    description: 'Dev/test parameterized route to verify OrgScopeGuard',
  },
  'POST /api/v1/_test/mutate': {
    category: 'authenticated',
    description: 'Dev/test mutating route to verify tenant RLS writes',
  },

  // Company Admin Routes - Templates
  'GET /api/v1/company/templates': {
    category: 'company_admin',
    description: 'List templates assigned to caller organization',
  },
  'GET /api/v1/company/templates/:id': {
    category: 'company_admin',
    description: 'Get details of an assigned template by ID or slug',
  },

  // Company Admin Routes - Assessments
  'GET /api/v1/company/assessments': {
    category: 'company_admin',
    description: 'List assessments created within caller organization',
  },
  'POST /api/v1/company/assessments': {
    category: 'company_admin',
    description: 'Create a new assessment from an assigned template version',
  },
  'GET /api/v1/company/assessments/:id': {
    category: 'company_admin',
    description: 'Get details of an assessment by ID',
  },
  'PATCH /api/v1/company/assessments/:id/brief': {
    category: 'company_admin',
    description: 'Update assessment candidate brief and scenario',
  },

  // Company Admin Routes - Candidates (/candidates prefix)
  'GET /api/v1/candidates': {
    category: 'company_admin',
    description: 'List candidates within caller organization',
  },
  'POST /api/v1/candidates': {
    category: 'company_admin',
    description: 'Create / invite candidate into caller organization',
  },
  'GET /api/v1/candidates/metrics': {
    category: 'company_admin',
    description: 'Candidate pipeline metrics and funnel stats',
  },
  'POST /api/v1/candidates/bulk': {
    category: 'company_admin',
    description: 'Bulk invite multiple candidates',
  },
  'PATCH /api/v1/candidates/:id': {
    category: 'company_admin',
    description: 'Update candidate profile information',
  },
  'DELETE /api/v1/candidates/:id': {
    category: 'company_admin',
    description: 'Soft-delete candidate profile',
  },
  'POST /api/v1/candidates/:id/resend-invite': {
    category: 'company_admin',
    description: 'Resend invitation email to candidate',
  },

  // Company Admin Routes - Candidates (/company/candidates prefix - alias)
  'GET /api/v1/company/candidates': {
    category: 'company_admin',
    description: 'List candidates within caller organization (company prefix alias)',
  },
  'POST /api/v1/company/candidates': {
    category: 'company_admin',
    description: 'Create candidate within caller organization (company prefix alias)',
  },
  'GET /api/v1/company/candidates/metrics': {
    category: 'company_admin',
    description: 'Candidate pipeline metrics (company prefix alias)',
  },
  'POST /api/v1/company/candidates/bulk': {
    category: 'company_admin',
    description: 'Bulk invite candidates (company prefix alias)',
  },
  'PATCH /api/v1/company/candidates/:id': {
    category: 'company_admin',
    description: 'Update candidate profile (company prefix alias)',
  },
  'DELETE /api/v1/company/candidates/:id': {
    category: 'company_admin',
    description: 'Soft-delete candidate (company prefix alias)',
  },
  'POST /api/v1/company/candidates/:id/resend-invite': {
    category: 'company_admin',
    description: 'Resend invitation (company prefix alias)',
  },

  // Company Admin Routes - Storage & Submissions
  'POST /api/v1/storage/upload': {
    category: 'company_admin',
    description: 'Direct submission artifact upload endpoint',
  },
  'GET /api/v1/storage/download-url/:assignmentId/:objectId': {
    category: 'company_admin',
    description: 'Submission artifact download URL generation',
  },
};

/**
 * Normalizes a route path for matrix lookup (stripping trailing slashes).
 */
export function normalizeRoute(method: string, url: string): string {
  const cleanUrl = url.replace(/\/+$/, '') || '/';
  return `${method.toUpperCase()} ${cleanUrl}`;
}

/**
 * Extracts all registered routes directly from the booted Fastify instance.
 * Parses the radix tree printed by Fastify printRoutes() by tracking tree depth.
 */
export function extractRegisteredRoutesFromApp(
  app: NestFastifyApplication,
): Array<{ method: string; url: string }> {
  const fastify = app.getHttpAdapter().getInstance();
  const routesStr = fastify.printRoutes({ commonPrefix: false });
  const lines = routesStr.split('\n');
  const result: Array<{ method: string; url: string }> = [];

  const pattern = /^(.*?)[└├]──\s*([^\s(]+)\s*\(([A-Z,\s]+)\)/;
  const stack: Array<{ depth: number; path: string }> = [];

  for (const line of lines) {
    const match = line.match(pattern);
    if (!match) continue;

    const indent = match[1];
    const depth = Math.floor(indent.length / 4);
    const segment = match[2];
    const methods = match[3].split(',').map((m) => m.trim());

    while (stack.length > 0 && stack[stack.length - 1].depth >= depth) {
      stack.pop();
    }

    const parentPath = stack.length > 0 ? stack[stack.length - 1].path : '';
    const fullPath = parentPath + segment;

    stack.push({ depth, path: fullPath });

    for (const method of methods) {
      if (method !== 'HEAD') {
        result.push({ method, url: fullPath });
      }
    }
  }

  return result;
}
