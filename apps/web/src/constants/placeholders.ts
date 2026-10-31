import { deepFreeze } from './deep-freeze';

export const PLACEHOLDERS = deepFreeze({
  SEARCH: {
    CANDIDATES: 'Search by name or email...',
    TEMPLATES: 'Search templates by role or tag...',
    TEMPLATES_DETAILED: 'Search templates by title, role, or stack...',
    ASSESSMENTS: 'Search assessments...',
    ORGANIZATIONS: 'Search companies by name or slug...',
    AUDIT_LOGS: 'Search by actor, entity, or action...',
    GLOBAL_ADMIN: 'Search organizations, templates, audits...',
    GLOBAL_COMPANY: 'Search candidates, assessments, rubrics...',
    GLOBAL_CANDIDATE: 'Search assessments, tasks, submissions...',
  },
  INPUTS: {
    EMAIL: 'name@company.com',
    PASSWORD: 'Enter your password',
    NEW_PASSWORD: 'Create a secure password',
    CONFIRM_PASSWORD: 'Confirm your password',
    CANDIDATE_NAME: 'e.g. Jane Doe',
    CANDIDATE_EMAIL: 'e.g. jane.doe@example.com',
    ASSESSMENT_TITLE: 'e.g. Senior Backend Engineer Take-Home',
    COMPANY_NAME: 'e.g. Acme Corporation',
    COMPANY_SLUG: 'e.g. acme-corp',
  },
  MODALS: {
    CSV_UPLOAD_DROPZONE: 'Upload or drag CSV file...',
  },
  TEXTAREAS: {
    NOTES: 'Enter candidate solution notes...',
    ASSESSMENT_BRIEF: 'Provide scenario background, business requirements, and task expectations...',
    RUBRIC_CRITERION_GOAL: 'What should the candidate demonstrate for this criterion?',
  },
} as const);

export type PlaceholdersConfig = typeof PLACEHOLDERS;
