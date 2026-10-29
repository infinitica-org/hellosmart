import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../components/button';
import { Badge } from '../components/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/card';
import { Input } from '../components/input';
import { StatCard } from '../components/stat-card';
import { Alert } from '../feedback/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../navigation/tabs';
import { Sidebar } from '../navigation/sidebar';
import { Topbar } from '../navigation/topbar';
import { PageHeader } from '../page-header';

const meta: Meta = {
  title: 'Foundation/Dashboard chrome',
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj;

export const OperationsShell: Story = {
  render: () => (
    <div className="flex min-h-screen bg-canvas text-foreground">
      <Sidebar
        variant="dashboard"
        brandTitle="HelloSmart"
        currentPath="/company"
        userName="Priya Shah"
        userEmail="priya@acme.com"
        portalRole="company_admin"
        items={[
          { id: 'overview', label: 'Overview', href: '/company' },
          { id: 'assessments', label: 'Assessments', href: '/company/assessments', badge: 12 },
          { id: 'candidates', label: 'Candidates', href: '/company/candidates' },
          { id: 'workspaces', label: 'Workspaces', href: '/company/workspaces', badge: 2, badgeVariant: 'success' },
          { id: 'settings', label: 'Settings', href: '/company/settings' },
        ]}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          variant="dashboard"
          showLogo={false}
          title="Organization summary"
          userName="Priya Shah"
          userRole="Company Admin"
          notificationCount={3}
        />
        <main className="mx-auto w-full max-w-6xl flex-1 space-y-4 p-4 sm:p-5">
          <PageHeader
            title="Assessments"
            description="Live runs, reviewer scores, and workspace health."
            badge={{ text: '12 active', variant: 'info' }}
            actions={
              <>
                <Button size="sm" variant="outline">
                  Export
                </Button>
                <Button size="sm" variant="primary">
                  Invite candidate
                </Button>
              </>
            }
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Invited" value="48" description="This cycle" />
            <StatCard label="In progress" value="9" trend={{ value: '2', direction: 'up' }} />
            <StatCard label="Submitted" value="31" trend={{ value: '4%', direction: 'down' }} />
          </div>
          <Alert variant="info" title="Window open">
            Combined duration and window rules are enforced on the server (BR-08).
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="w-56">
                <Input placeholder="Search candidates" />
              </div>
              <Badge variant="success" dot>
                Online
              </Badge>
              <Badge variant="danger" dot>
                Offline
              </Badge>
              <Badge variant="warning" dot>
                Idle
              </Badge>
            </CardContent>
          </Card>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="clients">Candidates</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-4 text-[13px] text-[#5b6775]">
              Midnight chrome, left-accent navigation, and a cool gray canvas — HelloSmart brand
              orange is reserved for primary actions and the active nav rail.
            </TabsContent>
            <TabsContent value="clients" className="pt-4 text-[13px] text-[#5b6775]">
              Candidate list
            </TabsContent>
            <TabsContent value="config" className="pt-4 text-[13px] text-[#5b6775]">
              Configuration
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  ),
};
