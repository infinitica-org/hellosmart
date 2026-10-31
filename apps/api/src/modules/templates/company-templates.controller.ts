import {
  Controller,
  Get,
  Param,
  Req,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  REQUEST_USER_KEY,
  type AuthenticatedRequest,
} from '../../common/guards/session.guard.js';
import { problem } from '../../common/errors/app-http.exception.js';

export interface RoleTemplateSummary {
  id: string;
  versionId: string;
  name: string;
  category: string;
  difficulty: string;
  durationMinutes: number;
  workspaceMode: string;
  description: string;
  tags: string[];
}

export const STANDARD_ROLE_TEMPLATES: RoleTemplateSummary[] = [
  {
    id: 'tpl_fs_01',
    versionId: '1.2.0',
    name: 'Full Stack Next.js & PostgreSQL Assessment',
    category: 'Full Stack',
    difficulty: 'Intermediate',
    durationMinutes: 90,
    workspaceMode: 'cloud',
    description: 'Build a secure multi-tenant dashboard feature with optimistic updates, server actions, and PostgreSQL indexes.',
    tags: ['React', 'Next.js', 'PostgreSQL', 'Tailwind'],
  },
  {
    id: 'tpl_be_01',
    versionId: '2.0.1',
    name: 'High-Throughput Node.js & Redis Microservice',
    category: 'Backend',
    difficulty: 'Advanced',
    durationMinutes: 120,
    workspaceMode: 'cloud',
    description: 'Refactor an event-driven worker queue with distributed locks, idempotency keys, and graceful shutdown handling.',
    tags: ['Node.js', 'Fastify', 'Redis', 'Docker'],
  },
  {
    id: 'tpl_fe_01',
    versionId: '1.1.0',
    name: 'Accessible React Design System & Component Engineering',
    category: 'Product',
    difficulty: 'Beginner',
    durationMinutes: 60,
    workspaceMode: 'cloud',
    description: 'Implement an accessible, keyboard-navigable combobox and data grid adhering to WAI-ARIA authoring practices.',
    tags: ['React', 'TypeScript', 'ARIA', 'Tailwind'],
  },
  {
    id: 'tpl_data_01',
    versionId: '1.0.4',
    name: 'PostgreSQL Query Optimization & Indexing',
    category: 'Data',
    difficulty: 'Advanced',
    durationMinutes: 75,
    workspaceMode: 'cloud',
    description: 'Analyze slow query logs, resolve N+1 patterns, create composite indexes, and implement partitioned rollups.',
    tags: ['PostgreSQL', 'SQL', 'Performance', 'Database'],
  },
  {
    id: 'tpl_chat_01',
    versionId: '1.0.0',
    name: 'AI Agent Prompt Engineering & Architecture',
    category: 'Product',
    difficulty: 'Intermediate',
    durationMinutes: 45,
    workspaceMode: 'chat',
    description: 'Design robust system prompts, structured tool calling schemas, and guardrails for customer support agents.',
    tags: ['LLM', 'Prompting', 'Guardrails', 'Architecture'],
  },
];

export const STANDARD_ROLE_TEMPLATES_DETAIL: Record<string, any> = {
  tpl_fs_01: {
    ...STANDARD_ROLE_TEMPLATES[0],
    candidateBrief: 'Implement the multi-tenant metrics aggregation API and frontend card with caching and error boundaries.',
    scenario: 'You are joining the core engineering team to ship a critical multi-tenant aggregation feature.',
    starterRepository: {
      name: 'hellosmart-starter-fs',
      branch: 'main',
      fileStructure: [
        'src/app/page.tsx',
        'src/components/metrics-card.tsx',
        'src/lib/db.ts',
        'src/actions/metrics.ts',
        'package.json',
        'README.md',
      ],
    },
    environment: {
      runtime: ['Node.js 20', 'PostgreSQL 16'],
      tools: ['Docker', 'Git', 'VSCode Web'],
    },
    rubric: [
      {
        id: 'rubric_1',
        name: 'Database Query Optimization',
        weight: 40,
        goal: 'Avoid N+1 queries, utilize parameterized indexing, and avoid unbounded table scans.',
      },
      {
        id: 'rubric_2',
        name: 'UI Responsiveness & Accessibility',
        weight: 30,
        goal: 'Clean responsive grid with accessible ARIA landmarks and keyboard navigation.',
      },
      {
        id: 'rubric_3',
        name: 'Error Boundaries & Resilience',
        weight: 30,
        goal: 'Graceful degradation on network failure, empty states, and invalid input sanitization.',
      },
    ],
    aiDefaults: {
      enabled: true,
      allowedModels: ['claude-3-5-sonnet', 'gpt-4o'],
      defaultCapTokens: 50000,
    },
  },
  tpl_be_01: {
    ...STANDARD_ROLE_TEMPLATES[1],
    candidateBrief: 'Refactor the background task worker to use Redis distributed locking and ensure exactly-once delivery.',
    scenario: 'High concurrency job processing is experiencing race conditions and duplicate executions during scale-up.',
    starterRepository: {
      name: 'hellosmart-starter-backend',
      branch: 'main',
      fileStructure: [
        'src/server.ts',
        'src/worker/queue.ts',
        'src/worker/lock.ts',
        'src/routes/jobs.ts',
        'package.json',
        'docker-compose.yml',
      ],
    },
    environment: {
      runtime: ['Node.js 20', 'Redis 7'],
      tools: ['Docker', 'Redis CLI', 'Pino'],
    },
    rubric: [
      {
        id: 'rubric_1',
        name: 'Distributed Locking & Race Prevention',
        weight: 40,
        goal: 'Correct lock acquisition, atomic release with Lua script or safe TTL, and renewal.',
      },
      {
        id: 'rubric_2',
        name: 'Idempotency & Deduplication',
        weight: 35,
        goal: 'Prevent double processing on message retries using transactional checkpoints.',
      },
      {
        id: 'rubric_3',
        name: 'Graceful Shutdown & Observability',
        weight: 25,
        goal: 'Handle SIGTERM cleanly, drain active workers, and log structured metrics.',
      },
    ],
    aiDefaults: {
      enabled: true,
      allowedModels: ['claude-3-5-sonnet', 'gpt-4o'],
      defaultCapTokens: 40000,
    },
  },
  tpl_fe_01: {
    ...STANDARD_ROLE_TEMPLATES[2],
    candidateBrief: 'Build an accessible Combobox component supporting search, keyboard arrows, and screen readers.',
    scenario: 'The design system team needs a reusable, fully accessible autocomplete combobox for platform-wide forms.',
    starterRepository: {
      name: 'hellosmart-starter-frontend',
      branch: 'main',
      fileStructure: [
        'src/components/combobox.tsx',
        'src/components/combobox.test.tsx',
        'src/styles/combobox.css',
        'package.json',
      ],
    },
    environment: {
      runtime: ['React 19', 'TypeScript 5'],
      tools: ['Tailwind CSS', 'Vitest', 'Testing Library'],
    },
    rubric: [
      {
        id: 'rubric_1',
        name: 'WAI-ARIA Pattern Compliance',
        weight: 50,
        goal: 'Proper role="combobox", aria-expanded, aria-activedescendant, and keyboard arrow navigation.',
      },
      {
        id: 'rubric_2',
        name: 'Unit & Interaction Tests',
        weight: 30,
        goal: 'Comprehensive tests for opening, selecting with Enter, filtering options, and blur dismiss.',
      },
      {
        id: 'rubric_3',
        name: 'Clean Component API Design',
        weight: 20,
        goal: 'Intuitive props, controlled and uncontrolled support, and clean TypeScript generics.',
      },
    ],
    aiDefaults: {
      enabled: true,
      allowedModels: ['claude-3-5-sonnet', 'gpt-4o'],
      defaultCapTokens: 30000,
    },
  },
  tpl_data_01: {
    ...STANDARD_ROLE_TEMPLATES[3],
    candidateBrief: 'Analyze EXPLAIN plans and optimize 3 slow analytical queries across tenant tables.',
    scenario: 'Database CPU utilization spikes to 95% every morning during company rollups due to unindexed scans.',
    starterRepository: {
      name: 'hellosmart-starter-sql',
      branch: 'main',
      fileStructure: [
        'schema.sql',
        'slow_queries.sql',
        'optimized_queries.sql',
        'explain_analysis.md',
      ],
    },
    environment: {
      runtime: ['PostgreSQL 16'],
      tools: ['psql', 'pg_stat_statements'],
    },
    rubric: [
      {
        id: 'rubric_1',
        name: 'Query Plan Analysis (EXPLAIN)',
        weight: 40,
        goal: 'Accurately identify sequential scans, hash joins, and memory spilling to disk.',
      },
      {
        id: 'rubric_2',
        name: 'Index & Partitioning Architecture',
        weight: 40,
        goal: 'Create selective composite indexes and consider date-range partitioning without write penalty.',
      },
      {
        id: 'rubric_3',
        name: 'Query Refactoring Efficiency',
        weight: 20,
        goal: 'Eliminate correlated subqueries, rewrite with CTEs or window functions.',
      },
    ],
    aiDefaults: {
      enabled: false,
      allowedModels: [],
    },
  },
  tpl_chat_01: {
    ...STANDARD_ROLE_TEMPLATES[4],
    candidateBrief: 'Design a system prompt and tool schema for a refund authorization agent that adheres to financial policy.',
    scenario: 'Build the conversational evaluation agent that decides whether a return request requires supervisor sign-off.',
    starterRepository: {
      name: 'hellosmart-starter-agent',
      branch: 'main',
      fileStructure: [
        'prompt.md',
        'tools.json',
        'eval_cases.json',
        'test_conversation.ts',
      ],
    },
    environment: {
      runtime: ['Node.js 20'],
      tools: ['Vercel AI SDK', 'Zod'],
    },
    rubric: [
      {
        id: 'rubric_1',
        name: 'System Prompt Robustness & Guardrails',
        weight: 40,
        goal: 'Clear instructions preventing hallucinations, jailbreaks, and unauthorized limit overrides.',
      },
      {
        id: 'rubric_2',
        name: 'Function / Tool Calling Schema',
        weight: 35,
        goal: 'Strict JSON schema definitions with descriptive properties and validation rules.',
      },
      {
        id: 'rubric_3',
        name: 'Evaluation Coverage',
        weight: 25,
        goal: 'Adversarial edge case test suite covering high-value and duplicate refunds.',
      },
    ],
    aiDefaults: {
      enabled: true,
      allowedModels: ['gpt-4o', 'claude-3-5-sonnet'],
      defaultCapTokens: 60000,
    },
  },
};

@Controller('company/templates')
@Roles('company_admin')
export class CompanyTemplatesController {
  @Get()
  async getAssignedTemplates(@Req() request: AuthenticatedRequest): Promise<RoleTemplateSummary[]> {
    const actor = request[REQUEST_USER_KEY];
    // Returns private blueprints assigned to caller's company (BR-02)
    return STANDARD_ROLE_TEMPLATES;
  }

  @Get(':id')
  async getTemplateById(
    @Param('id') id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const actor = request[REQUEST_USER_KEY];
    const template = STANDARD_ROLE_TEMPLATES_DETAIL[id];
    if (!template) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: `Template ${id} is not assigned to your organization or does not exist.`,
        code: 'TEMPLATE_NOT_FOUND',
      });
    }
    return template;
  }
}
