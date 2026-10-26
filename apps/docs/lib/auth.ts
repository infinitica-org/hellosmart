export type TeamRole = 'sde' | 'ai' | 'qa' | 'mgmt' | 'master';

export interface RoleConfig {
  id: TeamRole;
  name: string;
  badge: string;
  description: string;
  color: string;
}

export const TEAM_ROLES: Record<TeamRole, RoleConfig> = {
  sde: {
    id: 'sde',
    name: 'SDE Team',
    badge: 'SDE Team',
    description: 'Software Development Engineers (Backend API, Next.js Web, DB Migrations, Sysbox Workspaces, Monorepo)',
    color: '#3b82f6',
  },
  ai: {
    id: 'ai',
    name: 'AI Team',
    badge: 'AI Team',
    description: 'AI & ML Engineers (Reviewer Agents, AI Proxy, Model Routing, Rubric Prompts, Egress Security, Token Budgets)',
    color: '#a855f7',
  },
  qa: {
    id: 'qa',
    name: 'QA Team',
    badge: 'QA Team',
    description: 'Quality Assurance & SDETs (Tenancy RLS Validation, Playwright E2E, Test Seeds, Security Verification)',
    color: '#eab308',
  },
  mgmt: {
    id: 'mgmt',
    name: 'Managing Team',
    badge: 'Managing Team',
    description: 'Product Managers, Delivery Leads & Founders (BR-01 to BR-33, Commercial, Pricing, Roadmap, Delivery Plan)',
    color: '#06b6d4',
  },
  master: {
    id: 'master',
    name: 'Master Access',
    badge: 'Master Access',
    description: 'Full unconstrained platform visibility across all team playbooks and internal architecture',
    color: '#10b981',
  },
};

export const AUTH_COOKIE_NAME = 'hs_docs_role';
