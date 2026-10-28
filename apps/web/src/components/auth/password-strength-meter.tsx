'use client';

import React from 'react';

export interface PasswordRule {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordEvaluation {
  score: number; // 0 - 5
  isStrong: boolean; // all 5 met
  rules: PasswordRule[];
  label: string;
  colorClass: string;
}

export function evaluatePassword(password: string): PasswordEvaluation {
  const rules: PasswordRule[] = [
    {
      id: 'length',
      label: 'At least 12 characters',
      met: password.length >= 12 && password.length <= 128,
    },
    {
      id: 'uppercase',
      label: 'At least one uppercase letter (A-Z)',
      met: /[A-Z]/.test(password),
    },
    {
      id: 'lowercase',
      label: 'At least one lowercase letter (a-z)',
      met: /[a-z]/.test(password),
    },
    {
      id: 'number',
      label: 'At least one number (0-9)',
      met: /[0-9]/.test(password),
    },
    {
      id: 'special',
      label: 'At least one special character (!@#$%^&*)',
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];

  const score = rules.filter((r) => r.met).length;
  const isStrong = score === 5;

  let label = 'Very Weak';
  let colorClass = 'bg-red-500';

  if (score >= 5) {
    label = 'Strong';
    colorClass = 'bg-emerald-500';
  } else if (score >= 4) {
    label = 'Good';
    colorClass = 'bg-emerald-400';
  } else if (score >= 3) {
    label = 'Fair';
    colorClass = 'bg-amber-400';
  } else if (score >= 2) {
    label = 'Weak';
    colorClass = 'bg-orange-400';
  }

  return { score, isStrong, rules, label, colorClass };
}

interface PasswordStrengthMeterProps {
  password: string;
  showRules?: boolean;
}

export function PasswordStrengthMeter({
  password,
  showRules = true,
}: PasswordStrengthMeterProps): React.JSX.Element {
  const evaluation = evaluatePassword(password);
  const percentage = (evaluation.score / 5) * 100;

  return (
    <div className="space-y-3" aria-live="polite">
      {/* Strength Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs font-medium text-slate-600 mb-1">
          <span>Password strength</span>
          <span className="font-semibold">{password.length > 0 ? evaluation.label : 'None'}</span>
        </div>
        <div
          className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"
          role="progressbar"
          aria-valuenow={evaluation.score}
          aria-valuemin={0}
          aria-valuemax={5}
          aria-label="Password strength"
        >
          <div
            className={`h-full transition-all duration-300 ${evaluation.colorClass}`}
            style={{ width: `${password.length > 0 ? percentage : 0}%` }}
          />
        </div>
      </div>

      {/* Rules Checklist */}
      {showRules && (
        <ul className="text-xs space-y-1 text-slate-600" aria-label="Password requirements">
          {evaluation.rules.map((rule) => (
            <li key={rule.id} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  rule.met ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {rule.met ? '✓' : '•'}
              </span>
              <span className={rule.met ? 'text-slate-800 font-medium' : 'text-slate-500'}>
                {rule.label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
