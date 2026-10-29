import type { Meta, StoryObj } from '@storybook/react';
import { PageHeader } from './page-header';
import { Button } from './components/button';

const meta: Meta<typeof PageHeader> = {
  title: 'Layout/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
  args: {
    title: 'Companies & Tenants',
    description: 'Manage active customer organizations, quotas, and template permissions.',
    breadcrumbs: [
      { label: 'Admin', href: '/admin' },
      { label: 'Companies' },
    ],
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof PageHeader>;

export const Default: Story = {
  args: {},
};

export const WithBadgeAndActions: Story = {
  args: {
    title: 'Senior Systems Architect Simulation',
    description: 'Live Cloud VM environment with Go backend and Postgres services.',
    badge: {
      text: 'Published v1.2',
      variant: 'success',
    },
    breadcrumbs: [
      { label: 'Assessments', href: '/company/assessments' },
      { label: 'Senior Systems Architect' },
    ],
    actions: (
      <div className="flex gap-2">
        <Button variant="outline" size="sm">
          Preview Rubric
        </Button>
        <Button variant="primary" size="sm">
          Invite Candidates
        </Button>
      </div>
    ),
  },
};

export const SimpleWithoutBreadcrumbs: Story = {
  args: {
    title: 'Candidate Evaluation Dashboard',
    description: 'Real-time overview of candidate sessions, code diffs, and reviewer agent scores.',
    breadcrumbs: undefined,
  },
};

