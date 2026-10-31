import type { RoleTemplateSummary, RoleTemplateDetail } from '@/components/company/templates/types';

export const DEFAULT_ROLE_TEMPLATES: RoleTemplateSummary[] = [
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

export const DEFAULT_ROLE_TEMPLATES_DETAIL: Record<string, RoleTemplateDetail> = {
  tpl_fs_01: {
    ...DEFAULT_ROLE_TEMPLATES[0]!,
    candidateBrief: 'Implement the multi-tenant metrics aggregation API and frontend card with caching and error boundaries.',
    scenario: 'You are joining the core engineering team to ship a critical multi-tenant aggregation feature.',
    starterRepository: {
      name: 'hellosmart-starter-fs',
      branch: 'main',
      fileStructure: ['src/app/page.tsx', 'src/lib/db.ts', 'src/components/card.tsx', 'package.json'],
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
        goal: 'Avoid N+1 queries and utilize parameterized indexing.',
        scale: '0-100',
      },
      {
        id: 'rubric_2',
        name: 'UI Responsiveness & Accessibility',
        weight: 60,
        goal: 'Clean responsive grid with accessible ARIA landmarks.',
        scale: '0-100',
      },
    ],
    aiDefaults: {
      enabled: true,
      allowedModels: ['gpt-4o', 'claude-3-5-sonnet'],
    },
  },
  tpl_be_01: {
    ...DEFAULT_ROLE_TEMPLATES[1]!,
    candidateBrief: 'Refactor the background task worker to use Redis distributed locking and ensure exactly-once delivery.',
    scenario: 'A high-load service is experiencing race conditions and duplicate job processing under peak load.',
    starterRepository: {
      name: 'hellosmart-starter-be',
      branch: 'main',
      fileStructure: ['src/server.ts', 'src/queue.ts', 'src/lock.ts', 'package.json'],
    },
    environment: {
      runtime: ['Node.js 20', 'Redis 7'],
      tools: ['Docker', 'Git'],
    },
    rubric: [
      {
        id: 'rubric_1',
        name: 'Concurrency Control & Deadlock Prevention',
        weight: 50,
        goal: 'Proper acquisition, refresh, and release of locks without leaks.',
        scale: '0-100',
      },
      {
        id: 'rubric_2',
        name: 'Error Handling & Resilience',
        weight: 50,
        goal: 'Exponential backoff and poison pill dead-letter queue routing.',
        scale: '0-100',
      },
    ],
    aiDefaults: {
      enabled: true,
      allowedModels: ['gpt-4o', 'claude-3-5-sonnet'],
    },
  },
  tpl_fe_01: {
    ...DEFAULT_ROLE_TEMPLATES[2]!,
    candidateBrief: 'Build an accessible Combobox component supporting search, keyboard arrows, and screen readers.',
    scenario: 'Our design system needs a production-grade searchable dropdown component.',
    starterRepository: {
      name: 'hellosmart-starter-fe',
      branch: 'main',
      fileStructure: ['src/components/Combobox.tsx', 'src/App.tsx', 'package.json'],
    },
    environment: {
      runtime: ['Node.js 20', 'React 19'],
      tools: ['Vite', 'Tailwind'],
    },
    rubric: [
      {
        id: 'rubric_1',
        name: 'Keyboard Navigation & ARIA Compliance',
        weight: 50,
        goal: 'Tab, arrow navigation, escape to close, aria-expanded/aria-activedescendant.',
        scale: '0-100',
      },
      {
        id: 'rubric_2',
        name: 'Component Architecture & TypeScript Types',
        weight: 50,
        goal: 'Clean props interface, controlled/uncontrolled state support.',
        scale: '0-100',
      },
    ],
    aiDefaults: {
      enabled: true,
      allowedModels: ['gpt-4o'],
    },
  },
  tpl_data_01: {
    ...DEFAULT_ROLE_TEMPLATES[3]!,
    candidateBrief: 'Analyze EXPLAIN plans and optimize 3 slow analytical queries across tenant tables.',
    scenario: 'Customers are reporting 5-10 second latency on monthly billing aggregation queries.',
    starterRepository: {
      name: 'hellosmart-starter-data',
      branch: 'main',
      fileStructure: ['queries/report.sql', 'schema.sql', 'README.md'],
    },
    environment: {
      runtime: ['PostgreSQL 16'],
      tools: ['psql', 'pg_stat_statements'],
    },
    rubric: [
      {
        id: 'rubric_1',
        name: 'Index Selection & Query Plan Improvement',
        weight: 60,
        goal: 'Convert sequential scans to index scans, reducing buffer reads.',
        scale: '0-100',
      },
      {
        id: 'rubric_2',
        name: 'Idempotent Schema Migration',
        weight: 40,
        goal: 'CREATE INDEX CONCURRENTLY with safety guards.',
        scale: '0-100',
      },
    ],
    aiDefaults: {
      enabled: false,
      allowedModels: [],
    },
  },
  tpl_chat_01: {
    ...DEFAULT_ROLE_TEMPLATES[4]!,
    candidateBrief: 'Design a system prompt and tool schema for a refund authorization agent that adheres to financial policy.',
    scenario: 'We are automating tier-1 customer dispute handling with AI while enforcing policy guardrails.',
    starterRepository: {
      name: 'hellosmart-starter-ai',
      branch: 'main',
      fileStructure: ['prompt.md', 'tools.json', 'policy.pdf'],
    },
    environment: {
      runtime: ['Chat Workspace'],
      tools: ['AI Assistant'],
    },
    rubric: [
      {
        id: 'rubric_1',
        name: 'Policy Adherence & Guardrails',
        weight: 60,
        goal: 'Agent refuses unauthorized overrides and verifies identity.',
        scale: '0-100',
      },
      {
        id: 'rubric_2',
        name: 'Tool Schema Precision',
        weight: 40,
        goal: 'Valid JSON Schema with descriptions and enum constraints.',
        scale: '0-100',
      },
    ],
    aiDefaults: {
      enabled: true,
      allowedModels: ['gpt-4o', 'claude-3-5-sonnet'],
    },
  },
};

