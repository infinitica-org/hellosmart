/**
 * Role Template Catalog & Slide-Out Preview Drawer Type Definitions (#121)
 *
 * Aligns with AGENTS.md Section 6.2 (Templates & Assessments) and Section 8 (BR-02, BR-03).
 */

export type TemplateCategory = 'Full Stack' | 'Backend' | 'Data' | 'QA' | 'Product';
export type TemplateDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type WorkspaceMode = 'cloud' | 'chat';

export interface RubricDimensionPreview {
  id: string;
  name: string;
  weight: number; // 1-100 percentage
  goal: string;
  signals?: string[];
  scale?: '0-100' | '1-5';
}

export interface StarterRepositorySpec {
  name: string;
  branch: string;
  fileStructure: string[];
}

export interface EnvironmentSpec {
  runtime: string[]; // e.g., ["Node.js 20", "PostgreSQL 16"]
  tools: string[];    // e.g., ["Docker", "Git", "VSCode Web"]
}

export interface AiDefaultsSpec {
  enabled: boolean;
  allowedModels: string[];
  defaultCapTokens?: number;
}

/**
 * Lightweight summary returned by GET /api/v1/company/templates
 * Used for fast catalog rendering and search/filtering without loading heavy repo trees.
 */
export interface RoleTemplateSummary {
  id: string;
  versionId: string;
  name: string;
  category: TemplateCategory;
  difficulty: TemplateDifficulty;
  durationMinutes: number;
  workspaceMode: WorkspaceMode;
  description: string;
  tags: string[];
  assignedAt?: string;
}

/**
 * Full template specification returned on-demand by GET /api/v1/company/templates/:id
 * Loaded when the preview drawer opens.
 */
export interface RoleTemplateDetail extends RoleTemplateSummary {
  candidateBrief: string;
  scenario: string;
  starterRepository: StarterRepositorySpec;
  environment: EnvironmentSpec;
  rubric: RubricDimensionPreview[];
  aiDefaults?: AiDefaultsSpec;
}

export interface TemplateFilterState {
  searchQuery: string;
  category: TemplateCategory | 'All';
  difficulty: TemplateDifficulty | 'All';
}

