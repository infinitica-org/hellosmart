import { deepFreeze } from './deep-freeze';

export const ROUTES = deepFreeze({
  PUBLIC: {
    HOME: '/',
    DOCS: '/docs',
    PRIVACY: '/privacy',
    TERMS: '/terms',
  },
  AUTH: {
    LOGIN: '/login',
    ACCEPT_INVITE: '/accept-invite',
    SET_PASSWORD: '/set-password',
    CHANGE_PASSWORD: '/change-password',
  },
  COMPANY: {
    DASHBOARD: '/company',
    TEMPLATES: '/company/templates',
    ASSESSMENTS: '/company/assessments',
    NEW_ASSESSMENT: '/company/assessments/new',
    CANDIDATES: '/company/candidates',
    ANALYTICS: '/company/analytics',
    SETTINGS: '/company/settings',
    RUBRIC: (assessmentId: string) => `/company/assessments/${assessmentId}/rubric` as const,
  },
  CANDIDATE: {
    DASHBOARD: '/candidate',
    ASSESSMENTS: '/candidate/assessments',
    PROFILE: '/candidate/profile',
  },
  ADMIN: {
    DASHBOARD: '/admin',
    COMPANIES: '/admin/companies',
    AGENTS: '/admin/agents',
    AUDIT: '/admin/audit',
    SETTINGS: '/admin/settings',
    SECURITY: '/admin/settings/security',
  },
  API: {
    AUTH_LOGIN: '/api/auth/login',
    AUTH_LOGOUT: '/api/auth/logout',
    AUTH_ME: '/api/auth/me',
    AUTH_IDENTIFY: '/api/auth/identify',
    AUTH_ACCEPT_INVITE: '/api/auth/accept-invite',
    AUTH_SET_PASSWORD: '/api/auth/set-password',
    AUTH_CHANGE_PASSWORD: '/api/auth/change-password',
    CANDIDATES: '/api/v1/candidates',
    COMPANY_TEMPLATES: '/api/v1/company/templates',
    ASSESSMENTS: '/api/v1/assessments',
  },
} as const);

export type AppRoutes = typeof ROUTES;

