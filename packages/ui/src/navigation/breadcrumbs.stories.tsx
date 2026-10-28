import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  Breadcrumbs,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbHomeIcon,
} from './breadcrumbs';

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
  argTypes: {
    separatorVariant: {
      control: 'select',
      options: ['chevron', 'slash', 'arrow', 'dot'],
    },
    variant: {
      control: 'select',
      options: ['default', 'icons', 'pills'],
    },
    showHomeIcon: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Breadcrumbs>;

const folderIcon = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
    />
  </svg>
);

const assessmentIcon = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const userIcon = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

export const Default: Story = {
  args: {},
};

export const WithIcons: Story = {
  name: 'Breadcrumbs with Item Icons',
  args: {
    items: [
      { label: 'Home', href: '/', icon: <BreadcrumbHomeIcon className="w-3.5 h-3.5" /> },
      { label: 'Assessments', href: '/company/assessments', icon: folderIcon },
      { label: 'Full-Stack React AI', href: '/company/assessments/101', icon: assessmentIcon },
      { label: 'Sathesh Kumar (Review)', icon: userIcon },
    ],
  },
};

export const WithHomeIcon: Story = {
  name: 'Show Home Icon (showHomeIcon)',
  args: {
    showHomeIcon: true,
    items: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Company Settings', href: '/company/settings' },
      { label: 'AI Provider Keys (BR-16)' },
    ],
  },
};

export const SeparatorVariants: Story = {
  name: 'Separator Variants (Chevron, Slash, Arrow, Dot)',
  render: () => (
    <div className="flex flex-col gap-6 p-6 bg-white rounded-xl border border-neutral-200">
      <div>
        <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          1. Chevron Separator (`separatorVariant="chevron"`)
        </h4>
        <Breadcrumbs
          separatorVariant="chevron"
          showHomeIcon
          items={[
            { label: 'Home', href: '/' },
            { label: 'Candidates', href: '/candidates' },
            { label: 'Sathesh Kumar' },
          ]}
        />
      </div>

      <div>
        <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          2. Slash Separator (`separatorVariant="slash"`)
        </h4>
        <Breadcrumbs
          separatorVariant="slash"
          showHomeIcon
          items={[
            { label: 'Portal', href: '/portal' },
            { label: 'Workspaces', href: '/portal/workspaces' },
            { label: 'ws_8f93a1 (Cloud VM)' },
          ]}
        />
      </div>

      <div>
        <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          3. Arrow Separator (`separatorVariant="arrow"`)
        </h4>
        <Breadcrumbs
          separatorVariant="arrow"
          showHomeIcon
          items={[
            { label: 'Tasks', href: '/tasks' },
            { label: 'Reviewer Agents', href: '/tasks/agents' },
            { label: 'Rubric Signals (BR-18)' },
          ]}
        />
      </div>

      <div>
        <h4 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
          4. Dot Separator (`separatorVariant="dot"`)
        </h4>
        <Breadcrumbs
          separatorVariant="dot"
          showHomeIcon
          items={[
            { label: 'Settings', href: '/settings' },
            { label: 'Billing & Invoices', href: '/settings/billing' },
            { label: 'GST Invoice #INV-2026-001' },
          ]}
        />
      </div>
    </div>
  ),
};

export const PillVariantWithIcons: Story = {
  name: 'Pills Variant with Icons (`variant="pills"`)',
  render: () => (
    <div className="flex flex-col gap-4 p-6 bg-neutral-50 rounded-xl border border-neutral-200">
      <h4 className="text-xs font-semibold text-neutral-600 mb-1">
        Modern Contained Pill Breadcrumbs
      </h4>
      <Breadcrumbs
        variant="pills"
        separatorVariant="chevron"
        items={[
          { label: 'Home', href: '/', icon: <BreadcrumbHomeIcon className="w-3.5 h-3.5" /> },
          { label: 'Assessments', href: '/assessments', icon: folderIcon },
          { label: 'Frontend Architecture', href: '/assessments/42', icon: assessmentIcon },
          { label: 'Active Session', icon: userIcon },
        ]}
      />
    </div>
  ),
};

export const ComposedBreadcrumbsWithIcons: Story = {
  name: 'Composed Breadcrumbs with Custom Icons',
  render: () => (
    <Breadcrumbs>
      <ol className="flex items-center space-x-2">
        <BreadcrumbItem>
          <BreadcrumbLink href="/candidate" icon={<BreadcrumbHomeIcon className="w-3.5 h-3.5" />}>
            Candidate Portal
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator variant="chevron" />
        <BreadcrumbItem>
          <BreadcrumbLink href="/candidate/assessments" icon={assessmentIcon}>
            My Assessments
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator variant="chevron" />
        <BreadcrumbItem>
          <BreadcrumbPage icon={userIcon}>System Design Cloud VM</BreadcrumbPage>
        </BreadcrumbItem>
      </ol>
    </Breadcrumbs>
  ),
};
