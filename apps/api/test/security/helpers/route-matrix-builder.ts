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
  // Public health / infra probes
  'GET /api/v1/health': { category: 'public', description: 'Liveness probe' },
  'GET /api/v1/health/ready': { category: 'public', description: 'Readiness probe' },
  'GET /api/v1/ready': { category: 'public', description: 'Readiness probe fallback' },

  // Public dev test ping (non-production only)
  'GET /api/v1/_test/ping': { category: 'public', description: 'Dev test ping probe' },
  'POST /api/v1/_test/mutate': { category: 'public', description: 'Dev test mutation probe' },
  'GET /api/v1/_test/org/:orgId/ping': {
    category: 'authenticated',
    description: 'Dev test org-scoped ping',
  },

  // Public auth & invitation flows
  'POST /api/v1/auth/login': { category: 'public', description: 'Password & MFA authentication' },
  'POST /api/v1/auth/identify': { category: 'public', description: 'Email realm identification' },
  'POST /api/v1/auth/mfa/verify': { category: 'public', description: 'MFA TOTP verification' },
  'GET /api/v1/auth/invitations/:token': { category: 'public', description: 'Invitation lookup' },
  'POST /api/v1/auth/invitations/accept': {
    category: 'public',
    description: 'Invitation accept & activation',
  },

  // Public artifact download (HMAC token protected)
  'GET /api/v1/storage/download': { category: 'public', description: 'Signed URL artifact stream' },

  // Authenticated common user routes (any active role)
  'GET /api/v1/me': {
    category: 'authenticated',
    description: 'Current authenticated user profile',
  },
  'POST /api/v1/auth/logout': { category: 'authenticated', description: 'Single session logout' },
  'POST /api/v1/auth/logout-all': {
    category: 'authenticated',
    description: 'Global session logout',
  },
  'POST /api/v1/auth/password/change': {
    category: 'authenticated',
    description: 'Password change',
  },
  'GET /api/v1/auth/sessions': { category: 'authenticated', description: 'Active session list' },
  'DELETE /api/v1/auth/sessions/:id': {
    category: 'authenticated',
    description: 'Revoke single session',
  },

  // Platform admin exclusive routes
  'GET /api/v1/auth/mfa/status': {
    category: 'platform_admin',
    description: 'Platform admin MFA status',
  },
  'POST /api/v1/auth/mfa/setup/start': {
    category: 'platform_admin',
    description: 'Platform admin MFA start',
  },
  'POST /api/v1/auth/mfa/setup/confirm': {
    category: 'platform_admin',
    description: 'Platform admin MFA confirm',
  },
  'POST /api/v1/auth/mfa/backup-codes/regenerate': {
    category: 'platform_admin',
    description: 'Regenerate backup codes',
  },
  'GET /api/v1/admin/organizations': {
    category: 'platform_admin',
    description: 'Admin organization list',
  },
  'POST /api/v1/admin/organizations': {
    category: 'platform_admin',
    description: 'Admin organization provision',
  },
  'PATCH /api/v1/admin/organizations/:id/status': {
    category: 'platform_admin',
    description: 'Admin org status update',
  },
  'GET /api/v1/admin/metrics': { category: 'platform_admin', description: 'Platform-wide metrics' },
  'GET /api/v1/admin/templates': {
    category: 'platform_admin',
    description: 'Admin template catalog',
  },
  'POST /api/v1/admin/templates': {
    category: 'platform_admin',
    description: 'Admin template create',
  },
  'POST /api/v1/admin/templates/:id/assign': {
    category: 'platform_admin',
    description: 'Admin template assign single',
  },
  'POST /api/v1/admin/templates/:id/assign/bulk': {
    category: 'platform_admin',
    description: 'Admin template assign bulk',
  },
  'DELETE /api/v1/admin/templates/:id/assign/:orgId': {
    category: 'platform_admin',
    description: 'Admin template revoke assign',
  },
  'POST /api/v1/admin/templates/:id/clone': {
    category: 'platform_admin',
    description: 'Admin template version clone',
  },
  'POST /api/v1/admin/templates/:id/versions/:version/publish': {
    category: 'platform_admin',
    description: 'Admin template publish',
  },

  // Company admin routes - Templates
  'GET /api/v1/company/templates': {
    category: 'company_admin',
    description: 'Assigned templates list',
  },
  'GET /api/v1/company/templates/:id': {
    category: 'company_admin',
    description: 'Assigned template detail',
  },

  // Company admin routes - Assessments
  'POST /api/v1/company/assessments': {
    category: 'company_admin',
    description: 'Create assessment from template',
  },
  'GET /api/v1/company/assessments': {
    category: 'company_admin',
    description: 'List company assessments',
  },
  'GET /api/v1/company/assessments/:id': {
    category: 'company_admin',
    description: 'Get assessment by id',
  },
  'PATCH /api/v1/company/assessments/:id/brief': {
    category: 'company_admin',
    description: 'Update assessment brief override',
  },

  // Company admin routes - Candidates (/candidates prefix)
  'GET /api/v1/candidates': { category: 'company_admin', description: 'List candidates' },
  'GET /api/v1/candidates/metrics': { category: 'company_admin', description: 'Candidate metrics' },
  'POST /api/v1/candidates': { category: 'company_admin', description: 'Create candidate' },
  'POST /api/v1/candidates/bulk': {
    category: 'company_admin',
    description: 'Bulk create candidates',
  },
  'PATCH /api/v1/candidates/:id': { category: 'company_admin', description: 'Update candidate' },
  'DELETE /api/v1/candidates/:id': {
    category: 'company_admin',
    description: 'Soft-delete candidate',
  },
  'POST /api/v1/candidates/:id/resend-invite': {
    category: 'company_admin',
    description: 'Resend candidate invite',
  },

  // Company admin routes - Candidates (/company/candidates prefix dual-serving)
  'GET /api/v1/company/candidates': {
    category: 'company_admin',
    description: 'List candidates (company prefix)',
  },
  'GET /api/v1/company/candidates/metrics': {
    category: 'company_admin',
    description: 'Candidate metrics (company prefix)',
  },
  'POST /api/v1/company/candidates': {
    category: 'company_admin',
    description: 'Create candidate (company prefix)',
  },
  'POST /api/v1/company/candidates/bulk': {
    category: 'company_admin',
    description: 'Bulk create candidates (company prefix)',
  },
  'PATCH /api/v1/company/candidates/:id': {
    category: 'company_admin',
    description: 'Update candidate (company prefix)',
  },
  'DELETE /api/v1/company/candidates/:id': {
    category: 'company_admin',
    description: 'Soft-delete candidate (company prefix)',
  },
  'POST /api/v1/company/candidates/:id/resend-invite': {
    category: 'company_admin',
    description: 'Resend candidate invite (company prefix)',
  },

  // Storage upload & download URLs
  'POST /api/v1/storage/upload': {
    category: 'candidate',
    description: 'Candidate submission artifact upload',
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
 */
export function extractRegisteredRoutesFromApp(
  app: NestFastifyApplication,
): Array<{ method: string; url: string }> {
  const fastify = app.getHttpAdapter().getInstance();
  const routesStr = fastify.printRoutes({ commonPrefix: false });
  const lines = routesStr.split('\n');
  const result: Array<{ method: string; url: string }> = [];

  const regex = /([\/a-zA-Z0-9_\-:*]+)\s+\(([A-Z,\s]+)\)/;
  for (const line of lines) {
    const match = line.match(regex);
    if (match) {
      const url = match[1];
      const methods = match[2].split(',').map((m) => m.trim());
      for (const method of methods) {
        if (method !== 'HEAD') {
          result.push({ method, url });
        }
      }
    }
  }

  return result;
}
