export * from './schemas/errors.js';
export * from './schemas/user.js';
export * from './schemas/auth.js';
export * from './schemas/session.js';
export * from './schemas/org.js';
export * from './schemas/manifest.js';
export * from './schemas/template.js';
export * from './schemas/assessment.js';

export * from './schemas/consent.js';
export * from './schemas/workspace-submission.js';

export * from './schemas/lead.js';
export * from './schemas/quote.js';

export * from './password-policy.js';
export * from './data/common-passwords.data.js';
export * from './constants/index.js';

export type * from './generated/api.js';
export * from './events.js';

import type { components, operations, paths } from './generated/api.js';

export type Schemas = components['schemas'];
export type ApiPaths = paths;
export type ApiOperations = operations;

// RFC 9457 Problem Details (also in schemas/errors.ts for Zod runtime validation)
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code: string;
  requestId?: string;
  errors?: Array<{ field?: string; message: string }>;
  reasons?: string[];
}
