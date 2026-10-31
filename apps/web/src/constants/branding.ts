import { deepFreeze } from './deep-freeze';

export const BRANDING = deepFreeze({
  APP_NAME: 'HelloSmart.ai',
  SHORT_NAME: 'HelloSmart',
  TAGLINE: 'Hire by doing.',
  SUBTITLE: 'AI-Native Hiring Platform',
  MISSION: 'Assess candidates by having them do real work with AI tools in controlled workspaces.',
  COPYRIGHT: '© 2026 HelloSmart.ai. All rights reserved.',
  SUPPORT_EMAIL: 'support@hellosmart.ai',
  SALES_EMAIL: 'sales@hellosmart.ai',
  POWERED_BY: 'Powered by hellosmart.ai',
  CAL_BOOKING_URL: 'https://cal.com/hellosmart',
  DOCS_URL: '/docs',
  PRIVACY_URL: '/privacy',
  TERMS_URL: '/terms',
} as const);

export type BrandingConfig = typeof BRANDING;

