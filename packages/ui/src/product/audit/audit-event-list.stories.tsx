import type { Meta, StoryObj } from '@storybook/react';
import { AuditEventList, AuditEventItem } from './audit-event-list';

const mockAuditEvents: AuditEventItem[] = [
  {
    id: 'aud_01',
    actorEmail: 'admin@hellosmart.ai',
    actorRole: 'platform_admin',
    action: 'ORG_PROVISIONED',
    entity: 'Organization: Stripe Technologies',
    at: new Date(Date.now() - 3600000).toISOString(),
    ip: '198.51.100.42',
  },
  {
    id: 'aud_02',
    actorEmail: 'recruiter@stripe.com',
    actorRole: 'company_admin',
    action: 'ASSESSMENT_PUBLISHED',
    entity: 'Assessment: Staff Distributed Systems v1.0',
    at: new Date(Date.now() - 1800000).toISOString(),
    ip: '203.0.113.19',
  },
  {
    id: 'aud_03',
    actorEmail: 'recruiter@stripe.com',
    actorRole: 'company_admin',
    action: 'CANDIDATE_INVITED',
    entity: 'Candidate: alex.candidate@domain.com',
    at: new Date(Date.now() - 900000).toISOString(),
    ip: '203.0.113.19',
  },
  {
    id: 'aud_04',
    actorEmail: 'alex.candidate@domain.com',
    actorRole: 'candidate',
    action: 'CONSENT_ACCEPTED',
    entity: 'Workspace: ws_c7f21a88 (Cloud VM)',
    at: new Date(Date.now() - 600000).toISOString(),
    ip: '192.0.2.77',
  },
  {
    id: 'aud_05',
    actorEmail: 'system_proxy',
    actorRole: 'reviewer_agent',
    action: 'WORKSPACE_SNAPSHOT',
    entity: 'Snapshot: snap_f419b02 (RPO <= 30s)',
    at: new Date().toISOString(),
  },
];

const meta: Meta<typeof AuditEventList> = {
  title: 'Domain/Audit/AuditEventList',
  component: AuditEventList,
  tags: ['autodocs'],
  args: {
    events: mockAuditEvents,
  },
};

export default meta;
type Story = StoryObj<typeof AuditEventList>;

export const PopulatedAuditTrail: Story = {
  args: {},
};

export const EmptyAuditTrail: Story = {
  args: {
    events: [],
  },
};

