import type { TemplateCategory, TemplateDifficulty } from '../components/company/templates/types';
import type { BadgeVariant } from '@hs/ui';

export const TEMPLATE_CATEGORIES: readonly (TemplateCategory | 'All')[] = [
  'All',
  'Full Stack',
  'Backend',
  'Data',
  'QA',
  'Product',
] as const;

export const TEMPLATE_DIFFICULTIES: readonly (TemplateDifficulty | 'All')[] = [
  'All',
  'Beginner',
  'Intermediate',
  'Advanced',
] as const;

export const DIFFICULTY_BADGE_CONFIG: Record<
  TemplateDifficulty,
  { variant: BadgeVariant; label: string }
> = {
  Beginner: {
    variant: 'success',
    label: 'Beginner',
  },
  Intermediate: {
    variant: 'warning',
    label: 'Intermediate',
  },
  Advanced: {
    variant: 'danger',
    label: 'Advanced',
  },
};

export const WORKSPACE_MODE_CONFIG: Record<
  'cloud' | 'chat',
  { label: string; icon: string; badgeVariant: BadgeVariant }
> = {
  cloud: {
    label: 'Cloud VM',
    icon: 'Terminal',
    badgeVariant: 'primary',
  },
  chat: {
    label: 'AI Chat',
    icon: 'Bot',
    badgeVariant: 'info',
  },
};

