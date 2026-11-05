'use client';

import React from 'react';
import {
  Input,
  FormField,
  FormLabel,
  FormError,
  FormDescription,
  Switch,
  Alert,
} from '@hs/ui';
import { AssessmentSummary } from '../assessment-summary';
import type { AssessmentFormValues, TimingType } from '../types';
import type { RoleTemplateDetail, RoleTemplateSummary } from '@/components/company/templates/types';

export interface AssessmentConfigurationStepProps {
  template: RoleTemplateDetail | RoleTemplateSummary;
  values: AssessmentFormValues;
  errors: Record<string, string>;
  onChange: (updates: Partial<AssessmentFormValues>) => void;
}

const DURATION_PRESETS = [45, 60, 90, 120, 180];

export function AssessmentConfigurationStep({
  template,
  values,
  errors,
  onChange,
}: AssessmentConfigurationStepProps): React.JSX.Element {
  const updateTiming = (updates: Partial<AssessmentFormValues['timing']>) => {
    onChange({
      timing: {
        ...values.timing,
        ...updates,
      },
    });
  };

  return (
    <div className="space-y-8" data-testid="wizard-step-3">
      {/* ─── Timing Mode & Parameters Card ─── */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-card-border shadow-xs space-y-6">
        <h4 className="text-sm font-bold uppercase tracking-wider text-neutral-500 font-mono">
          Assessment Timing &amp; Availability
        </h4>

        {/* Timing Type Selector */}
        <div className="space-y-2">
          <FormLabel required>Timing Enforcement Mode</FormLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Timing Mode">
            {(
              [
                { id: 'duration', label: 'Duration Only', desc: 'Candidate gets N minutes upon connect' },
                { id: 'window', label: 'Window Only', desc: 'Accessible only between Date A and Date B' },
                { id: 'both', label: 'Duration + Window', desc: 'N minutes within Date A and Date B' },
              ] as const
            ).map((mode) => {
              const isSelected = values.timing.type === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => updateTiming({ type: mode.id as TimingType })}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20 shadow-xs'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <div className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-neutral-900'}`}>
                    {mode.label}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-1 leading-normal">
                    {mode.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration in Minutes */}
        <FormField>
          <div className="flex items-center justify-between mb-1.5">
            <FormLabel htmlFor="assessment-duration" required>
              Candidate Time Allocation (Minutes)
            </FormLabel>
            <div className="flex items-center gap-1.5">
              {DURATION_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateTiming({ durationMinutes: p })}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                    values.timing.durationMinutes === p
                      ? 'bg-neutral-900 text-white'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                  }`}
                >
                  {p}m
                </button>
              ))}
            </div>
          </div>

          <Input
            id="assessment-duration"
            type="number"
            min={15}
            max={480}
            value={values.timing.durationMinutes}
            onChange={(e) => updateTiming({ durationMinutes: Number(e.target.value) || 0 })}
            data-testid="duration-minutes-input"
            className="h-11 rounded-xl text-sm border-neutral-200 focus:border-primary focus:ring-1 focus:ring-primary/20 max-w-xs font-mono"
          />
          <FormDescription>
            Enforced server-side. Workspace auto-submits when time expires. Range: 15–480 minutes.
          </FormDescription>
          {errors['timing.durationMinutes'] && (
            <FormError>{errors['timing.durationMinutes']}</FormError>
          )}
        </FormField>

        {/* Start / End Datetime inputs when window mode is active */}
        {(values.timing.type === 'window' || values.timing.type === 'both') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-200/80">
            <FormField>
              <FormLabel htmlFor="window-start" required>
                Testing Window Start (UTC)
              </FormLabel>
              <Input
                id="window-start"
                type="datetime-local"
                value={values.timing.windowStartUtc ? values.timing.windowStartUtc.slice(0, 16) : ''}
                onChange={(e) =>
                  updateTiming({
                    windowStartUtc: e.target.value ? new Date(e.target.value).toISOString() : '',
                  })
                }
                data-testid="window-start-input"
                className="h-10 rounded-xl text-xs sm:text-sm border-neutral-200 focus:border-primary"
              />
            </FormField>

            <FormField>
              <FormLabel htmlFor="window-end" required>
                Testing Window End (UTC)
              </FormLabel>
              <Input
                id="window-end"
                type="datetime-local"
                value={values.timing.windowEndUtc ? values.timing.windowEndUtc.slice(0, 16) : ''}
                onChange={(e) =>
                  updateTiming({
                    windowEndUtc: e.target.value ? new Date(e.target.value).toISOString() : '',
                  })
                }
                data-testid="window-end-input"
                className="h-10 rounded-xl text-xs sm:text-sm border-neutral-200 focus:border-primary"
              />
            </FormField>

            {errors['timing.windowEndUtc'] && (
              <div className="sm:col-span-2">
                <FormError>{errors['timing.windowEndUtc']}</FormError>
              </div>
            )}
          </div>
        )}

        {/* Pause Timer on Disconnect Toggle (BR-09) */}
        <div className="pt-4 border-t border-neutral-100 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <FormLabel htmlFor="pause-timer-toggle" className="cursor-pointer">
              Pause Timer During Disconnects
            </FormLabel>
            <p className="text-xs text-neutral-500 max-w-xl">
              Per business invariant BR-09, timer continues running while disconnected by default.
              Enable this only if you want the clock to stop when a candidate loses internet connection.
            </p>
          </div>

          <Switch
            id="pause-timer-toggle"
            checked={values.timing.pauseTimerOnDisconnect}
            onChange={(checked: boolean) => updateTiming({ pauseTimerOnDisconnect: checked })}
            data-testid="pause-timer-toggle"
          />
        </div>
      </div>

      {/* ─── Final Summary Review Card ─── */}
      <AssessmentSummary template={template} values={values} />
    </div>
  );
}

