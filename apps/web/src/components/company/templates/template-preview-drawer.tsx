'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer, Badge, Button, Alert, Skeleton } from '@hs/ui';
import { Clock, ArrowRight, Loader2 } from 'lucide-react';
import { useTemplateDetail } from '@/hooks/company/use-assigned-templates';
import type { RoleTemplateSummary } from './types';
import { DIFFICULTY_BADGE_CONFIG, WORKSPACE_MODE_CONFIG, ROUTES, UI_LABELS } from '@/constants';

export interface TemplatePreviewDrawerProps {
  templateId: string | null;
  summary?: RoleTemplateSummary | null;
  onClose: () => void;
}

export function TemplatePreviewDrawer({
  templateId,
  summary,
  onClose,
}: TemplatePreviewDrawerProps): React.JSX.Element {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  // Lazy fetch template specification on-demand
  const { data: detail, isLoading, isError, error } = useTemplateDetail(templateId);

  const activeTemplate = detail || summary;

  const difficultyCfg = activeTemplate
    ? DIFFICULTY_BADGE_CONFIG[activeTemplate.difficulty] || {
        variant: 'default',
        label: activeTemplate.difficulty,
      }
    : null;

  const modeCfg = activeTemplate
    ? WORKSPACE_MODE_CONFIG[activeTemplate.workspaceMode] || {
        label: activeTemplate.workspaceMode,
        badgeVariant: 'default',
      }
    : null;

  // Handle "Use This Template" action - navigates preserving versionId (BR-03)
  const handleUseTemplate = () => {
    if (!activeTemplate || isNavigating) return;

    setIsNavigating(true);
    const targetUrl = `${ROUTES.COMPANY.NEW_ASSESSMENT}?templateId=${encodeURIComponent(
      activeTemplate.id
    )}&versionId=${encodeURIComponent(activeTemplate.versionId)}`;

    router.push(targetUrl);
  };

  return (
    <Drawer
      open={Boolean(templateId)}
      onClose={() => {
        setIsNavigating(false);
        onClose();
      }}
      position="right"
      size="xl"
      showCloseButton={false}
      data-testid="template-preview-drawer"
      className="bg-white flex flex-col h-full shadow-2xl"
    >
      {/* ─── Drawer Header ─── */}
      <div className="p-6 border-b border-neutral-200/80 bg-neutral-50/50">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {activeTemplate?.category || 'Role Template'}
            </span>
            {activeTemplate?.versionId && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-200/80 text-neutral-700">
                v{activeTemplate.versionId}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {modeCfg && (
              <Badge variant={modeCfg.badgeVariant} size="sm">
                {modeCfg.label}
              </Badge>
            )}
            {difficultyCfg && (
              <Badge variant={difficultyCfg.variant} size="sm" dot>
                {difficultyCfg.label}
              </Badge>
            )}
          </div>
        </div>

        <h2 className="text-xl font-medium text-neutral-900 leading-snug">
          {activeTemplate?.name || (isLoading ? 'Loading Template…' : 'Template Specification')}
        </h2>

        {activeTemplate && (
          <div className="mt-2.5 flex items-center gap-3 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="w-4 h-4 text-neutral-400" />
              {activeTemplate.durationMinutes} mins allocation
            </span>
            <span>&bull;</span>
            <span>Private Organization Template (BR-02)</span>
          </div>
        )}
      </div>

      {/* ─── Drawer Content Body (Scrollable) ─── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Error / Unauthorized State */}
        {isError && (
          <Alert variant="error" className="text-xs">
            <div className="space-y-1">
              <div className="font-semibold">Unable to load template details</div>
              <p>
                {error?.message ||
                  'This blueprint may not be assigned to your organization or was archived.'}
              </p>
            </div>
          </Alert>
        )}

        {/* Loading Skeleton */}
        {isLoading && !detail && (
          <div className="space-y-6" data-testid="drawer-loading-skeleton">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-5/6 rounded" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-36 rounded" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          </div>
        )}

        {/* Populated Details */}
        {detail && (
          <>
            {/* Scenario Overview */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Simulation Scenario
              </h3>
              <p className="text-sm text-neutral-700 leading-relaxed bg-neutral-50 p-4 rounded-xl border border-neutral-200/70">
                {detail.scenario || detail.description}
              </p>
            </section>

            {/* Candidate Brief */}
            <section className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Candidate Task Brief
              </h3>
              <div className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line p-4 rounded-xl border border-neutral-200/80 bg-white shadow-2xs">
                {detail.candidateBrief}
              </div>
            </section>

            {/* Environment & Developer Tools */}
            {detail.environment && (
              <section className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Environment &amp; Stack
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border border-neutral-200/80 bg-neutral-50/50">
                    <span className="text-xs font-semibold text-neutral-900 block mb-2">
                      Runtimes &amp; DBs
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.environment.runtime.map((rt) => (
                        <span
                          key={rt}
                          className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white border border-neutral-200/80 text-neutral-800 shadow-2xs"
                        >
                          {rt}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-neutral-200/80 bg-neutral-50/50">
                    <span className="text-xs font-semibold text-neutral-900 block mb-2">
                      Pre-installed Tools
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {detail.environment.tools.map((tool) => (
                        <span
                          key={tool}
                          className="text-xs font-medium px-2.5 py-1 rounded-lg bg-white border border-neutral-200/80 text-neutral-800 shadow-2xs"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Starter Repository Structure */}
            {detail.starterRepository && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Starter Repository
                  </h3>
                  <span className="text-xs text-neutral-500 font-medium">
                    branch: {detail.starterRepository.branch || 'main'}
                  </span>
                </div>
                <div className="p-4 rounded-xl border border-neutral-800 bg-neutral-950 text-neutral-200 text-xs overflow-x-auto">
                  <div className="text-neutral-300 mb-2 font-semibold flex items-center gap-2">
                    <span>📁</span>
                    <span>{detail.starterRepository.name}</span>
                  </div>
                  <ul className="space-y-1.5 pl-4 border-l border-neutral-800">
                    {detail.starterRepository.fileStructure.map((file) => (
                      <li key={file} className="flex items-center gap-2 text-neutral-300">
                        <span className="text-neutral-600">├─</span> {file}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            {/* Rubric Dimensions Preview */}
            {detail.rubric && detail.rubric.length > 0 && (
              <section className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Evaluation Rubric (AI Agents)
                  </h3>
                  <span className="text-xs text-primary font-semibold">
                    Total: {detail.rubric.reduce((sum, r) => sum + r.weight, 0)}%
                  </span>
                </div>

                <div className="space-y-2.5">
                  {detail.rubric.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl border border-neutral-200/80 bg-white shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold text-neutral-900">{item.name}</h4>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          {item.weight}% weight
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600 leading-relaxed">{item.goal}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* AI Assistance Policy Defaults */}
            {detail.aiDefaults && (
              <section className="p-4 rounded-xl border border-neutral-200/80 bg-neutral-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
                    AI Assistance Policy (Defaults)
                  </h3>
                  <Badge variant={detail.aiDefaults.enabled ? 'success' : 'default'} size="sm">
                    {detail.aiDefaults.enabled ? 'AI Enabled' : 'AI Prohibited'}
                  </Badge>
                </div>
                {detail.aiDefaults.allowedModels && detail.aiDefaults.allowedModels.length > 0 && (
                  <div className="text-xs text-neutral-600 pt-1">
                    Allowed models: <span className="font-medium text-neutral-800">{detail.aiDefaults.allowedModels.join(', ')}</span>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {/* ─── Drawer Footer (Sticky Actions) ─── */}
      <div className="p-4 sm:p-6 border-t border-neutral-200 bg-white flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="md"
          onClick={() => {
            setIsNavigating(false);
            onClose();
          }}
          className="rounded-xl border-neutral-200 text-neutral-700 hover:bg-neutral-50"
        >
          Close
        </Button>

        <Button
          variant="primary"
          size="md"
          data-testid="use-this-template-btn"
          disabled={!activeTemplate || isLoading || isNavigating}
          onClick={handleUseTemplate}
          className="rounded-xl px-5 shadow-sm"
        >
          {isNavigating ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Opening Wizard…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <span>Use This Template</span>
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </div>
    </Drawer>
  );
}
