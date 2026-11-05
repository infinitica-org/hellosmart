import zxcvbn from 'zxcvbn';
import { COMMON_PASSWORDS_SET } from './data/common-passwords.data.js';

export type PasswordPolicyReason =
  | 'too_short'
  | 'too_long'
  | 'common'
  | 'contains_user_info'
  | 'weak'
  | 'breached'
  | 'reused';

export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

export interface PasswordPolicyContext {
  /** User role determining length requirements ('platform_admin' requires 14, others require 12) */
  role?: 'platform_admin' | 'company_admin' | 'candidate' | string | null | undefined;
  /** User's email address */
  email?: string | null | undefined;
  /** User's full name */
  name?: string | null | undefined;
  /** Associated company / organization name */
  companyName?: string | null | undefined;
  /** Explicit list of user inputs or profile terms to prevent in passwords */
  userInputs?: string[] | undefined;
}

export interface PasswordRequirements {
  /** True if password satisfies min and max length bounds */
  hasMinLength: boolean;
  /** True if password is not in the common password corpus */
  isNotCommon: boolean;
  /** True if password does not contain identifiable personal or company terms */
  isNotRelated: boolean;
}

export interface PasswordEvaluationResult {
  /** True only if all criteria are satisfied (score >= 3 and no rejection reasons) */
  ok: boolean;
  /** zxcvbn strength score (0-4) */
  score: PasswordStrengthScore;
  /** List of machine-readable failure reason codes */
  reasons: PasswordPolicyReason[];

  // Backward compatibility fields for UI integration (PR #79)
  /** Alias for ok */
  isValid: boolean;
  /** UI presentation label */
  label: 'Empty' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  /** Actionable guidance tip */
  tip: string;
  /** Granular requirement breakdown */
  requirements: PasswordRequirements;
}

export const SERVER_ERROR_MESSAGES: Record<PasswordPolicyReason, string> = {
  too_short: 'Password is too short. Please choose a longer phrase.',
  too_long: 'Password exceeds maximum allowed length of 128 characters.',
  common: 'This password is too common and easily guessed. Please choose a more unique phrase.',
  contains_user_info: 'Avoid using your name, email, or company name in your password.',
  weak: 'This password does not meet the minimum strength requirements. Add more words or length.',
  breached: 'This password was found in a known data breach. For your safety, choose a different one.',
  reused: 'You cannot reuse a recent password. Please choose a new one.',
};

/**
 * Maps raw server error codes to human-friendly feedback strings.
 */
export function mapServerError(code?: string | null): string | null {
  if (!code) return null;
  const normalized = code.toLowerCase().trim() as PasswordPolicyReason;
  if (normalized in SERVER_ERROR_MESSAGES) {
    return SERVER_ERROR_MESSAGES[normalized];
  }
  return code;
}

/**
 * Normalizes password input using Unicode NFKC.
 * Standard across validation, breach checking, and password hashing.
 */
export function normalizePassword(password: string): string {
  if (typeof password !== 'string') return '';
  return password.normalize('NFKC');
}

/**
 * Extracts non-trivial search tokens (>= 3 chars) from context for personal-info checking.
 */
function extractUserTokens(context?: PasswordPolicyContext): string[] {
  const tokens = new Set<string>();

  // Always check fixed company identifier
  tokens.add('hellosmart');

  if (!context) return Array.from(tokens);

  if (context.email) {
    const email = context.email.toLowerCase().trim();
    const parts = email.split('@');
    const localPart = parts[0] ?? '';
    if (localPart.length >= 3) {
      tokens.add(localPart);
    }
    // Also split on common punctuation in email names (e.g. "john.doe" -> "john", "doe")
    const subparts = localPart.split(/[^a-z0-9]/).filter((p) => p.length >= 3);
    for (const sp of subparts) {
      tokens.add(sp);
    }
  }

  if (context.name) {
    const cleanName = context.name.toLowerCase().trim();
    if (cleanName.length >= 3) {
      tokens.add(cleanName);
    }
    const nameParts = cleanName.split(/\s+/).filter((p) => p.length >= 3);
    for (const np of nameParts) {
      tokens.add(np);
    }
  }

  if (context.companyName) {
    const cleanCompany = context.companyName.toLowerCase().trim();
    if (cleanCompany.length >= 3) {
      tokens.add(cleanCompany);
    }
    const companyParts = cleanCompany.split(/\s+/).filter((p) => p.length >= 3);
    for (const cp of companyParts) {
      tokens.add(cp);
    }
  }

  if (Array.isArray(context.userInputs)) {
    for (const input of context.userInputs) {
      if (typeof input === 'string') {
        const clean = input.toLowerCase().trim();
        if (clean.length >= 3) {
          tokens.add(clean);
        }
      }
    }
  }

  return Array.from(tokens);
}

/**
 * Evaluates password strength and requirements deterministically.
 * Shared between API and Web client (S0-T17-1).
 *
 * @param password Raw input password
 * @param context Authoritative or advisory user context (role, email, name, company)
 * @param zxcvbnFn Optional custom/lazy-loaded zxcvbn instance (defaults to bundled zxcvbn)
 */
export function evaluatePassword(
  password: string,
  context?: PasswordPolicyContext,
  zxcvbnFn?: (pwd: string, userInputs?: string[]) => { score: number; feedback?: { warning?: string; suggestions?: string[] } },
): PasswordEvaluationResult {
  const normalized = normalizePassword(password);
  // Accurate Unicode character count (codepoints)
  const charLength = Array.from(normalized).length;

  const minLength = context?.role === 'platform_admin' ? 14 : 12;
  const maxLength = 128;

  if (charLength === 0) {
    return {
      ok: false,
      score: 0,
      reasons: ['too_short'],
      isValid: false,
      label: 'Empty',
      tip: `Enter a strong password of at least ${minLength} characters.`,
      requirements: {
        hasMinLength: false,
        isNotCommon: false,
        isNotRelated: true,
      },
    };
  }

  const reasons: PasswordPolicyReason[] = [];
  const pwdLower = normalized.toLowerCase();

  // 1. Length bounds
  let hasMinLength = true;
  if (charLength < minLength) {
    reasons.push('too_short');
    hasMinLength = false;
  }
  if (charLength > maxLength) {
    reasons.push('too_long');
    hasMinLength = false;
  }

  // 2. Common password check (10,000 common passwords)
  let isNotCommon = true;
  if (COMMON_PASSWORDS_SET.has(pwdLower)) {
    reasons.push('common');
    isNotCommon = false;
  }

  // 3. Personal / Organization containment check
  const userTokens = extractUserTokens(context);
  let isNotRelated = true;
  for (const token of userTokens) {
    if (pwdLower.includes(token)) {
      reasons.push('contains_user_info');
      isNotRelated = false;
      break;
    }
  }

  // 4. zxcvbn evaluation
  const evaluator = zxcvbnFn ?? zxcvbn;
  let zScore: PasswordStrengthScore = 0;
  try {
    const zRes = evaluator(normalized, userTokens);
    zScore = Math.min(Math.max(zRes.score, 0), 4) as PasswordStrengthScore;
  } catch {
    zScore = hasMinLength && isNotCommon && isNotRelated ? 3 : 1;
  }

  // Score threshold check: reject below 3
  if (zScore < 3 && !reasons.includes('weak')) {
    reasons.push('weak');
  }

  const ok = reasons.length === 0;

  // Determine tip and label
  const labels: Record<PasswordStrengthScore, 'Empty' | 'Weak' | 'Fair' | 'Good' | 'Strong'> = {
    0: 'Weak',
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
  };
  const label = labels[zScore];

  let tip = 'Your password meets all complexity requirements.';
  if (reasons.includes('too_short')) {
    tip = `Make your password at least ${minLength} characters long.`;
  } else if (reasons.includes('too_long')) {
    tip = 'Password cannot exceed 128 characters.';
  } else if (reasons.includes('common')) {
    tip = 'This is a commonly used password. Try combining 3 or more unrelated words.';
  } else if (reasons.includes('contains_user_info')) {
    tip = 'Avoid personal details or company names in your password.';
  } else if (reasons.includes('weak') || zScore < 3) {
    tip = 'Add more words or length to increase password strength.';
  }

  return {
    ok,
    score: zScore,
    reasons,
    isValid: ok,
    label,
    tip,
    requirements: {
      hasMinLength,
      isNotCommon,
      isNotRelated,
    },
  };
}
