'use client';

import React, { useId, useMemo } from 'react';
import { Check, AlertCircle, ShieldCheck } from '../icons/lucide';

export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface PasswordRequirements {
  /** True if password length is at least 8 characters. */
  hasMinLength: boolean;
  /** True if password is not in the list of common/easily guessed passwords. */
  isNotCommon: boolean;
  /** True if password does not contain the user's name, email, or company. */
  isNotRelated: boolean;
}

export interface PasswordEvaluationResult {
  score: PasswordStrengthLevel;
  label: 'Empty' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  tip: string;
  requirements: PasswordRequirements;
  isValid: boolean;
}

export type ServerErrorCode = 'common' | 'breached' | 'reused' | 'weak';

export const SERVER_ERROR_MESSAGES: Record<ServerErrorCode, string> = {
  common: 'This password is too common and easily guessed. Please choose a more unique phrase.',
  breached: 'This password was found in a known data breach. For your safety, choose a different one.',
  reused: 'You cannot reuse a previous password. Please choose a new one.',
  weak: 'This password does not meet the minimum strength requirements. Add more words or length.',
};

/**
 * Maps raw server error codes to human-friendly feedback strings.
 */
export function mapServerError(code?: string | null): string | null {
  if (!code) return null;
  const normalized = code.toLowerCase().trim();
  if (normalized in SERVER_ERROR_MESSAGES) {
    return SERVER_ERROR_MESSAGES[normalized as ServerErrorCode];
  }
  return code;
}

// Common dictionary of frequently breached/guessed passwords
const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  'qwerty123',
  'welcome',
  'welcome1',
  'admin',
  'admin123',
  'letmein',
  'monkey',
  'sunshine',
  'princess',
  'football',
  'iloveyou',
  'hellosmart',
  'changeme',
]);

/**
 * Evaluates password strength and requirements consistently between UI and API.
 * S0-T17-1 shared password evaluation algorithm.
 * 
 * Note: Never logs or emits passwords. Evaluation is pure and advisory.
 */
export function evaluatePassword(
  password: string,
  userInputs: string[] = []
): PasswordEvaluationResult {
  if (!password || password.length === 0) {
    return {
      score: 0,
      label: 'Empty',
      tip: 'Enter a strong password of at least 8 characters.',
      requirements: {
        hasMinLength: false,
        isNotCommon: false,
        isNotRelated: true,
      },
      isValid: false,
    };
  }

  const pwdLower = password.toLowerCase();

  // 1. Length check (min 8)
  const hasMinLength = password.length >= 8;

  // 2. Common password check
  let isNotCommon = true;
  if (COMMON_PASSWORDS.has(pwdLower)) {
    isNotCommon = false;
  } else {
    // Check if contains very common root
    for (const common of COMMON_PASSWORDS) {
      if (common.length >= 6 && pwdLower.includes(common)) {
        isNotCommon = false;
        break;
      }
    }
  }

  // 3. Name or company related check
  let isNotRelated = true;
  for (const input of userInputs) {
    if (!input || typeof input !== 'string') continue;
    const cleanInput = input.toLowerCase().trim();
    if (cleanInput.length >= 3) {
      // Direct substring match
      if (pwdLower.includes(cleanInput)) {
        isNotRelated = false;
        break;
      }
      // If email, also check username part before @
      if (cleanInput.includes('@')) {
        const username = cleanInput.split('@')[0];
        if (username && username.length >= 3 && pwdLower.includes(username)) {
          isNotRelated = false;
          break;
        }
      }
    }
  }

  // 4. Calculate 4-level strength score
  let score: PasswordStrengthLevel = 1;
  let tip = 'Add another word or mix numbers and symbols.';

  if (!hasMinLength) {
    score = 1;
    tip = 'Make your password at least 8 characters long.';
  } else if (!isNotCommon) {
    score = 1;
    tip = 'This is a very common password. Try combining unrelated words.';
  } else if (!isNotRelated) {
    score = 1;
    tip = 'Avoid personal details or company names in your password.';
  } else {
    // Variety and entropy estimation
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    const varietyCount = [hasUpper, hasLower, hasDigit, hasSpecial].filter(Boolean).length;

    if (password.length >= 14 && varietyCount >= 3) {
      score = 4;
      tip = 'Excellent password! Highly resilient to brute-force attacks.';
    } else if (password.length >= 10 && varietyCount >= 3) {
      score = 3;
      tip = 'Strong password. Good combination of length and characters.';
    } else if (password.length >= 8 && varietyCount >= 2) {
      score = 2;
      tip = 'Make it longer or add variety to strengthen your password.';
    } else {
      score = 1;
      tip = 'Add another word or mix uppercase, numbers, and symbols.';
    }
  }

  const labelMap: Record<PasswordStrengthLevel, 'Empty' | 'Weak' | 'Fair' | 'Good' | 'Strong'> = {
    0: 'Empty',
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong',
  };

  const isValid = hasMinLength && isNotCommon && isNotRelated && score >= 2;

  return {
    score,
    label: labelMap[score],
    tip,
    requirements: {
      hasMinLength,
      isNotCommon,
      isNotRelated,
    },
    isValid,
  };
}

export interface PasswordStrengthMeterProps {
  /** The current password string. Never logged or sent across network. */
  password: string;
  /** Personal/company contextual keywords to prevent in password (e.g. [name, email, company]). */
  userInputs?: string[];
  /** Optional server error code or message to display under field. */
  serverError?: string | null;
  /** Whether to show live checkmarks for length, common, and name/company. Defaults to true. */
  showRequirements?: boolean;
  /** Optional CSS class name for outer container. */
  className?: string;
  /** Optional callback fired when evaluation result changes. */
  onEvaluationChange?: (result: PasswordEvaluationResult) => void;
}

export function PasswordStrengthMeter({
  password,
  userInputs = [],
  serverError,
  showRequirements = true,
  className = '',
  onEvaluationChange,
}: PasswordStrengthMeterProps): React.JSX.Element {
  const meterId = useId();

  // Pure advisory evaluation
  const evaluation = useMemo(() => {
    const res = evaluatePassword(password, userInputs);
    onEvaluationChange?.(res);
    return res;
  }, [password, userInputs, onEvaluationChange]);

  const { score, label, tip, requirements } = evaluation;

  // Visual segment colors and badge styling
  const levelStyles: Record<
    PasswordStrengthLevel,
    { segmentColor: string; textColor: string; badgeBg: string }
  > = {
    0: {
      segmentColor: 'bg-neutral-200',
      textColor: 'text-neutral-500',
      badgeBg: 'bg-neutral-100',
    },
    1: {
      segmentColor: 'bg-rose-500',
      textColor: 'text-rose-700',
      badgeBg: 'bg-rose-50 border-rose-200',
    },
    2: {
      segmentColor: 'bg-amber-500',
      textColor: 'text-amber-700',
      badgeBg: 'bg-amber-50 border-amber-200',
    },
    3: {
      segmentColor: 'bg-emerald-500',
      textColor: 'text-emerald-700',
      badgeBg: 'bg-emerald-50 border-emerald-200',
    },
    4: {
      segmentColor: 'bg-emerald-600',
      textColor: 'text-emerald-800',
      badgeBg: 'bg-emerald-100 border-emerald-300',
    },
  };

  const friendlyServerError = mapServerError(serverError);

  return (
    <div className={`w-full space-y-2 mt-2 ${className}`} data-testid="password-strength-meter">
      {/* 4-level Progress Bar & Label */}
      {password.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-500 font-medium">Password strength</span>
            {/* Accessible label badge — does not rely on color alone */}
            <span
              data-testid="strength-label"
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${levelStyles[score].badgeBg} ${levelStyles[score].textColor} flex items-center gap-1`}
            >
              {score >= 3 ? (
                <ShieldCheck className="w-3 h-3 shrink-0" aria-hidden="true" />
              ) : null}
              {label} ({score}/4)
            </span>
          </div>

          {/* 4 Segments */}
          <div
            className="flex gap-1.5 h-1.5 w-full"
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={4}
            aria-label={`Password strength: ${label}`}
          >
            {[1, 2, 3, 4].map((step) => {
              const isActive = score >= step;
              return (
                <div
                  key={step}
                  data-testid={`strength-bar-step-${step}`}
                  className={`flex-1 h-full rounded-full transition-all duration-300 ${
                    isActive ? levelStyles[score].segmentColor : 'bg-neutral-200'
                  }`}
                />
              );
            })}
          </div>

          {/* Plain language tip */}
          <p
            id={`${meterId}-tip`}
            data-testid="strength-tip"
            className="text-xs text-neutral-600 mt-1"
          >
            {tip}
          </p>

          {/* Screen reader announcement for a11y */}
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            Password strength: {label}. {tip}
          </div>
        </div>
      )}

      {/* Live Requirement Checklist */}
      {showRequirements && (
        <div className="pt-1">
          <p className="text-xs font-medium text-neutral-700 mb-1.5">Password requirements:</p>
          <ul
            className="space-y-1 text-xs text-neutral-600"
            aria-label="Password requirements checklist"
          >
            <li
              data-testid="req-length"
              className={`flex items-center gap-2 transition-colors ${
                requirements.hasMinLength ? 'text-emerald-700 font-medium' : 'text-neutral-500'
              }`}
            >
              {requirements.hasMinLength ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
              ) : (
                <span
                  className="w-3.5 h-3.5 rounded-full border border-neutral-300 flex items-center justify-center text-[10px] text-neutral-400 shrink-0"
                  aria-hidden="true"
                >
                  •
                </span>
              )}
              <span>At least 8 characters</span>
            </li>

            <li
              data-testid="req-not-common"
              className={`flex items-center gap-2 transition-colors ${
                requirements.isNotCommon ? 'text-emerald-700 font-medium' : 'text-neutral-500'
              }`}
            >
              {requirements.isNotCommon ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
              ) : (
                <span
                  className="w-3.5 h-3.5 rounded-full border border-neutral-300 flex items-center justify-center text-[10px] text-neutral-400 shrink-0"
                  aria-hidden="true"
                >
                  •
                </span>
              )}
              <span>Not a commonly used password</span>
            </li>

            <li
              data-testid="req-not-related"
              className={`flex items-center gap-2 transition-colors ${
                requirements.isNotRelated ? 'text-emerald-700 font-medium' : 'text-neutral-500'
              }`}
            >
              {requirements.isNotRelated ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
              ) : (
                <span
                  className="w-3.5 h-3.5 rounded-full border border-neutral-300 flex items-center justify-center text-[10px] text-neutral-400 shrink-0"
                  aria-hidden="true"
                >
                  •
                </span>
              )}
              <span>Not related to your name or company</span>
            </li>
          </ul>
        </div>
      )}

      {/* Server Rejection Messages Display */}
      {friendlyServerError && (
        <div
          role="alert"
          data-testid="server-error-alert"
          className="p-2.5 rounded-md bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2 mt-2"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
          <span className="font-medium leading-relaxed">{friendlyServerError}</span>
        </div>
      )}
    </div>
  );
}

