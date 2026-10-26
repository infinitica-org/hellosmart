import type { Meta, StoryObj } from '@storybook/react';
import {
  Sidebar,
  DEFAULT_ADMIN_NAV_ITEMS,
  DEFAULT_COMPANY_NAV_ITEMS,
  DEFAULT_CANDIDATE_NAV_ITEMS,
} from './sidebar';

const meta: Meta<typeof Sidebar> = {
  title: 'Navigation/Sidebar',
  component: Sidebar,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    currentPath: '/admin',
    userName: 'Platform Root Admin',
    userEmail: 'admin@hellosmart.ai',
    portalTitle: 'Admin Portal',
    portalRole: 'platform_admin',
    items: DEFAULT_ADMIN_NAV_ITEMS,
  },
  argTypes: {
    portalRole: {
      control: 'select',
      options: ['platform_admin', 'company_admin', 'candidate'],
    },
    whiteLabel: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Sidebar>;

export const PlatformAdminPortal: Story = {
  render: (args) => (
    <div className="flex h-screen bg-canvas">
      <Sidebar {...args} portalRole="platform_admin" items={DEFAULT_ADMIN_NAV_ITEMS} />
      <main className="flex-1 p-8 text-slate-800">
        <h1 className="text-2xl font-bold font-heading">Admin Console View</h1>
        <p className="text-slate-600 mt-2">Managing multi-tenant organizations, entitlements, and reviewer agents.</p>
      </main>
    </div>
  ),
};

export const CompanyAdminPortal: Story = {
  render: () => (
    <div className="flex h-screen bg-canvas">
      <Sidebar
        portalTitle="Company Portal"
        portalRole="company_admin"
        companyName="Stripe Technologies"
        userName="Sarah Connor"
        userEmail="sarah@stripe.com"
        currentPath="/company/assessments"
        items={DEFAULT_COMPANY_NAV_ITEMS}
      />
      <main className="flex-1 p-8 text-slate-800">
        <h1 className="text-2xl font-bold font-heading">Assessments</h1>
        <p className="text-slate-600 mt-2">Active engineering assessments and candidate evaluation runs.</p>
      </main>
    </div>
  ),
};

export const CandidatePortal: Story = {
  render: () => (
    <div className="flex h-screen bg-canvas">
      <Sidebar
        portalTitle="Candidate Portal"
        portalRole="candidate"
        companyName="Stripe Assessment"
        userName="Alex Rivera"
        userEmail="alex.rivera@example.com"
        currentPath="/candidate/assessments"
        items={DEFAULT_CANDIDATE_NAV_ITEMS}
      />
      <main className="flex-1 p-8 text-slate-800">
        <h1 className="text-2xl font-bold font-heading">My Assessments</h1>
        <p className="text-slate-600 mt-2">Your assigned work simulation tasks and cloud environments.</p>
      </main>
    </div>
  ),
};

