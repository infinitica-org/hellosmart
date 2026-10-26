import type { Meta, StoryObj } from '@storybook/react';
import { Breadcrumbs, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from './breadcrumbs';

const meta: Meta<typeof Breadcrumbs> = {
  title: 'Navigation/Breadcrumbs',
  component: Breadcrumbs,
  tags: ['autodocs'],
  args: {
    items: [
      { label: 'Admin', href: '/admin' },
      { label: 'Companies', href: '/admin/companies' },
      { label: 'Acme Corp Settings' },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof Breadcrumbs>;

export const Default: Story = {
  args: {},
};

export const DeepNavigation: Story = {
  args: {
    items: [
      { label: 'Home', href: '/' },
      { label: 'Company Portal', href: '/company' },
      { label: 'Assessments', href: '/company/assessments' },
      { label: 'Senior Backend Engineer', href: '/company/assessments/123' },
      { label: 'Candidate Submissions' },
    ],
  },
};

export const ComposedBreadcrumbs: Story = {
  render: () => (
    <Breadcrumbs>
      <ol className="flex items-center space-x-2">
        <BreadcrumbItem>
          <BreadcrumbLink href="/candidate">Candidate Portal</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink href="/candidate/assessments">My Assessments</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>System Design Cloud VM</BreadcrumbPage>
        </BreadcrumbItem>
      </ol>
    </Breadcrumbs>
  ),
};

