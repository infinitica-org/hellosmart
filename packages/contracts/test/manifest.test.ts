import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TemplateManifestSchema,
  validateTemplateManifest,
  TemplateSummaryDtoSchema,
  TemplateDetailDtoSchema,
} from '../dist/index.js';

describe('Template Manifest v1 Schema & Validator (NF-018)', () => {
  const validCloudManifest = {
    template: 'backend-incident-debug',
    name: 'Backend Incident Debugging Simulation',
    version: '1.0.0',
    mode: 'cloud',
    category: 'Backend',
    difficulty: 'Advanced',
    tags: ['nodejs', 'postgresql', 'debugging'],
    runtime: {
      image: 'node:20-alpine',
      size: 'medium',
      isolation: 'shared',
      services: 'compose.yaml',
      coding_agents: ['claude-code', 'codex'],
      egress_allow: ['github.com', 'registry.npmjs.org'],
    },
    repo: {
      source: 'https://github.com/hellosmart-templates/incident-debug',
      ref: '0123456789abcdef0123456789abcdef01234567',
    },
    seed: 'seed/',
    env_slots: [
      { name: 'DATABASE_URL', secret: true, required: true },
      { name: 'DEBUG_PORT', secret: false, required: false },
    ],
    ai_defaults: {
      enabled: true,
      models: ['claude-3-7-sonnet', 'gpt-4o'],
      cap_usd: 5,
      rpm: 20,
    },
    brief: 'Investigate the database connection leak in the microservice and submit a tested fix with documentation.',
    deliverables: [
      'src/patch.diff',
      { path: 'NOTES.md', description: 'Root cause analysis and prevention steps' },
      { hidden_tests: 'pnpm test:hidden' },
    ],
    reviewers: ['task-completion', 'debugging-process', 'ai-collaboration', 'code-quality'],
    golden_submissions: 'golden/',
    timing_default: {
      type: 'duration',
      duration_minutes: 120,
    },
  };

  it('validates a complete cloud workspace manifest', () => {
    const res = validateTemplateManifest(validCloudManifest);
    assert.equal(res.success, true);
    assert.ok(res.data);
    assert.equal(res.data?.template, 'backend-incident-debug');
    assert.equal(res.data?.mode, 'cloud');
    assert.equal(res.data?.reviewers.length, 4);
  });

  it('validates a chat workspace manifest without runtime requirement', () => {
    const chatManifest = {
      template: 'ai-prompt-eval',
      name: 'AI Prompt Evaluation & Strategy',
      version: '0.1.0',
      mode: 'chat',
      tags: ['ai', 'prompts'],
      ai_defaults: {
        enabled: true,
        models: ['claude-3-7-sonnet'],
        cap_usd: 2.5,
        rpm: 10,
      },
      brief: 'Evaluate model outputs for hallucinations and craft guardrail instructions for support bots.',
      deliverables: ['prompt-spec.md'],
      reviewers: ['prompt-quality', 'guardrail-robustness'],
      timing_default: {
        type: 'duration',
        duration_minutes: 60,
      },
    };

    const res = validateTemplateManifest(chatManifest);
    assert.equal(res.success, true);
    assert.ok(res.data);
    assert.equal(res.data?.mode, 'chat');
  });

  it('rejects cloud workspace mode when runtime is missing', () => {
    const invalidCloud = {
      ...validCloudManifest,
      runtime: undefined,
    };

    const res = validateTemplateManifest(invalidCloud);
    assert.equal(res.success, false);
    assert.ok(
      res.errors?.some((e) =>
        e.message.includes("Cloud workspace mode requires a complete 'runtime' configuration"),
      ),
    );
  });

  it('rejects invalid semantic versioning format', () => {
    const invalidVersion = {
      ...validCloudManifest,
      version: '1.0', // Missing patch
    };

    const res = validateTemplateManifest(invalidVersion);
    assert.equal(res.success, false);
    assert.ok(res.errors?.some((e) => e.path.includes('version')));
  });

  it('rejects invalid template slug with uppercase or special characters', () => {
    const invalidSlug = {
      ...validCloudManifest,
      template: 'Backend_Incident_Debug!',
    };

    const res = validateTemplateManifest(invalidSlug);
    assert.equal(res.success, false);
    assert.ok(res.errors?.some((e) => e.path.includes('template')));
  });

  it('rejects duplicate reviewer rubric dimensions', () => {
    const duplicateReviewers = {
      ...validCloudManifest,
      reviewers: ['task-completion', 'code-quality', 'task-completion'],
    };

    const res = validateTemplateManifest(duplicateReviewers);
    assert.equal(res.success, false);
    assert.ok(
      res.errors?.some((e) =>
        e.message.includes('Reviewer rubric dimensions cannot contain duplicate keys'),
      ),
    );
  });

  it('rejects manifests with fewer than 2 rubric dimensions', () => {
    const singleReviewer = {
      ...validCloudManifest,
      reviewers: ['only-one-dimension'],
    };

    const res = validateTemplateManifest(singleReviewer);
    assert.equal(res.success, false);
    assert.ok(
      res.errors?.some((e) =>
        e.message.includes('Manifest must specify at least 2 distinct reviewer rubric dimensions'),
      ),
    );
  });

  it('rejects invalid repo commit SHA ref', () => {
    const invalidSha = {
      ...validCloudManifest,
      repo: {
        source: 'https://github.com/example/repo',
        ref: 'not-a-valid-hex-commit-sha!@#',
      },
    };

    const res = validateTemplateManifest(invalidSha);
    assert.equal(res.success, false);
    assert.ok(res.errors?.some((e) => e.path.includes('repo')));
  });

  it('rejects empty or brief descriptions below 10 characters', () => {
    const shortBrief = {
      ...validCloudManifest,
      brief: 'Too short',
    };

    const res = validateTemplateManifest(shortBrief);
    assert.equal(res.success, false);
    assert.ok(res.errors?.some((e) => e.path.includes('brief')));
  });

  it('rejects duration minutes outside the 5 to 1440 range', () => {
    const invalidDuration = {
      ...validCloudManifest,
      timing_default: {
        type: 'duration',
        duration_minutes: 2, // Less than minimum 5
      },
    };

    const res = validateTemplateManifest(invalidDuration);
    assert.equal(res.success, false);
    assert.ok(res.errors?.some((e) => e.path.includes('duration_minutes')));
  });

  it('validates TemplateSummaryDto and TemplateDetailDto schemas', () => {
    const summary = {
      id: 'tpl_fs_01',
      versionId: '1.2.0',
      name: 'Full Stack Next.js Assessment',
      category: 'Full Stack',
      difficulty: 'Intermediate',
      durationMinutes: 90,
      workspaceMode: 'cloud',
      description: 'Build a secure multi-tenant dashboard feature.',
      tags: ['React', 'Next.js', 'PostgreSQL'],
      status: 'published',
    };

    const parsedSummary = TemplateSummaryDtoSchema.parse(summary);
    assert.equal(parsedSummary.id, 'tpl_fs_01');

    const detail = {
      ...summary,
      manifest: validCloudManifest,
      candidateBrief: validCloudManifest.brief,
      rubricPreview: [
        { dimension: 'task-completion', weight: 40, description: 'Fixes the leak' },
        { dimension: 'code-quality', weight: 60, description: 'Clean architecture' },
      ],
    };

    const parsedDetail = TemplateDetailDtoSchema.parse(detail);
    assert.equal(parsedDetail.manifest.template, 'backend-incident-debug');
  });
});
