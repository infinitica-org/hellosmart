import { deepFreeze } from './deep-freeze';

export const ALERT_MESSAGES = deepFreeze({
  AUTH: {
    LOGIN_SUCCESS: 'Logged in successfully',
    LOGOUT_SUCCESS: 'Logged out successfully',
    INVALID_CREDENTIALS: 'Invalid email or password.',
    ACCOUNT_LOCKED: 'Too many failed login attempts. Try again later.',
    SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
    UNAUTHORIZED: 'You do not have permission to access this resource.',
    MFA_REQUIRED: 'Multi-factor authentication required for platform administrators.',
  },
  CANDIDATES: {
    INVITE_SUCCESS: 'Candidate invitation sent successfully.',
    RESEND_SUCCESS: 'Candidate invite link refreshed and resent.',
    RESEND_DELIVERY_FAILED: 'Invite link was refreshed, but the invitation email could not be delivered.',
    UPDATE_SUCCESS: 'Candidate details updated successfully.',
    DELETE_SUCCESS: 'Candidate removed from your organization.',
    DELETE_CONFIRM_TITLE: 'Delete Candidate',
    DELETE_CONFIRM_DESCRIPTION: 'Are you sure you want to remove this candidate? This will revoke pending invitations and remove their workspace access.',
    DELETE_FAILED: 'Failed to delete candidate.',
    INVITE_FAILED: 'Failed to invite candidate.',
    UPDATE_FAILED: 'Failed to update candidate.',
    EMPTY_ACTIVE_ASSESSMENTS: 'No active assessments. When an assessment is assigned by your employer, it will appear here.',
  },
  CSV: {
    FILE_SIZE_EXCEEDS_50MB: 'File size exceeds allowed 50MB limit',
    FILE_TOO_LARGE: 'File size exceeds 2 MB limit.',
    TOO_MANY_ROWS: 'File contains more than 500 candidate rows.',
    EMPTY_FILE: 'The selected CSV file is empty.',
    NO_VALID_ROWS: 'No valid candidate rows found in the CSV file.',
    PARSE_ERROR: 'Failed to parse CSV file. Ensure valid RFC 4180 formatting.',
    INVALID_EMAIL_FORMAT_AT_ROW: (row: number) => `Invalid email format at row ${row}`,
  },
  ASSESSMENTS: {
    SUBMITTED_SUCCESS: 'Assessment has been submitted successfully',
    CREATE_SUCCESS: 'Assessment created successfully.',
    PUBLISH_SUCCESS: 'Assessment published and ready for candidate invitations.',
  },
  RUBRIC: {
    TOTAL_WEIGHT_MUST_EQUAL_100: 'Total rubric weight must equal exactly 100%',
    WEIGHT_SUM_ERROR: 'Rubric criteria weights must sum to exactly 100%.',
    MIN_ITEMS_ERROR: 'At least one rubric scoring criterion is required.',
  },
  NETWORK: {
    GENERIC_ERROR: 'An unexpected error occurred. Please try again.',
    FAILED_TO_LOAD: 'Failed to load data. Please refresh or try again later.',
    SERVER_UNREACHABLE: 'Unable to connect to the server. Check your network connection.',
  },
} as const);

export const MESSAGES = ALERT_MESSAGES;
export type AlertMessagesConfig = typeof ALERT_MESSAGES;
