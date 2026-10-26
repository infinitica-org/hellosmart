import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  List,
  ListItem,
} from './table';
import { Badge } from './badge';
import { Button } from './button';

const meta: Meta<typeof Table> = {
  title: 'Foundation/Table',
  component: Table,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Table>;

const mockCompanies = [
  { id: 'org_01', name: 'Acme Systems', slug: 'acme-systems', plan: 'pro', status: 'paid_active', candidates: 42 },
  { id: 'org_02', name: 'Stripe Labs', slug: 'stripe-labs', plan: 'trial', status: 'trial_active', candidates: 18 },
  { id: 'org_03', name: 'Supabase Inc', slug: 'supabase-inc', plan: 'pro', status: 'paid_active', candidates: 95 },
  { id: 'org_04', name: 'Vercel Global', slug: 'vercel-global', plan: 'pro', status: 'suspended', candidates: 6 },
];

export const OrganizationTable: Story = {
  render: () => (
    <Table className="bg-white border-neutral-200">
      <TableHeader className="bg-neutral-50 border-neutral-200 text-neutral-600">
        <TableRow>
          <TableHead>Company Name</TableHead>
          <TableHead>Slug (Tenant ID)</TableHead>
          <TableHead>Plan</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Candidates</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody className="divide-neutral-100">
        {mockCompanies.map((c) => (
          <TableRow key={c.id} className="hover:bg-neutral-50/80">
            <TableCell className="font-medium text-neutral-900">{c.name}</TableCell>
            <TableCell className="font-mono text-xs text-neutral-500">{c.slug}</TableCell>
            <TableCell className="capitalize text-neutral-700">{c.plan}</TableCell>
            <TableCell>
              <Badge
                variant={c.status === 'paid_active' ? 'success' : c.status === 'suspended' ? 'danger' : 'primary'}
                dot
              >
                {c.status.replace('_', ' ')}
              </Badge>
            </TableCell>
            <TableCell className="text-neutral-700">{c.candidates}</TableCell>
            <TableCell className="text-right">
              <Button size="sm" variant="outline">Manage</Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

export const ListComponent: Story = {
  render: () => (
    <List className="max-w-md bg-white border border-neutral-200 divide-neutral-100">
      <ListItem className="flex items-center justify-between p-4">
        <div>
          <h4 className="font-medium text-neutral-900 text-sm">Frontend Architect Evaluation</h4>
          <p className="text-xs text-neutral-500">Duration: 90 mins</p>
        </div>
        <Badge variant="success">Published</Badge>
      </ListItem>
      <ListItem className="flex items-center justify-between p-4">
        <div>
          <h4 className="font-medium text-neutral-900 text-sm">Distributed Systems Engineer</h4>
          <p className="text-xs text-neutral-500">Duration: 60 mins</p>
        </div>
        <Badge variant="default">Draft</Badge>
      </ListItem>
    </List>
  ),
};

