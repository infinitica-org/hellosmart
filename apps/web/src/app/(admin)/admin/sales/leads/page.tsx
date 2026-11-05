'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  Card,
  Input,
  Button,
  Badge,
  EmptyState,
} from '@hs/ui';
import { Search, Plus, ExternalLink, Calendar, RefreshCw } from 'lucide-react';
import { useGetLeadsQuery } from '@/store/admin/adminApi';
import { ROUTES } from '@/constants';

export default function LeadsAndBookingsPage() {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');

  const { data: leads = [], isLoading, refetch } = useGetLeadsQuery();

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      !search ||
      lead.email.toLowerCase().includes(search.toLowerCase()) ||
      (lead.name && lead.name.toLowerCase().includes(search.toLowerCase())) ||
      (lead.company && lead.company.toLowerCase().includes(search.toLowerCase()));

    const matchesStage = stageFilter === 'all' || lead.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'meeting_booked':
        return <Badge variant="info">Meeting Booked</Badge>;
      case 'meeting_held':
        return <Badge variant="primary">Meeting Held</Badge>;
      case 'quoted':
        return <Badge variant="warning">Quoted</Badge>;
      case 'paid':
        return <Badge variant="success">Paid</Badge>;
      default:
        return <Badge variant="default">{stage}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads & Cal.com Bookings"
        description="Prospective customer leads ingested from Cal.com webhooks with UTM attribution and booking history."
        badge={{ text: 'SP-001', variant: 'default' }}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        }
      />

      <Card className="p-6 space-y-5">
        {/* Controls: Search & Stage filter pills */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="w-full sm:w-72">
            <Input
              size="sm"
              placeholder="Search by name, email, company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={search ? () => setSearch('') : undefined}
              leftIcon={<Search className="w-4 h-4 text-neutral-400" />}
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto bg-neutral-100 p-1 rounded-xl text-xs">
            {['all', 'meeting_booked', 'meeting_held', 'quoted', 'paid'].map((stage) => (
              <Button
                key={stage}
                type="button"
                variant={stageFilter === stage ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setStageFilter(stage)}
                className="capitalize text-xs px-2.5 py-1"
              >
                {stage.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Leads Table */}
        {filteredLeads.length === 0 && !isLoading ? (
          <EmptyState
            title="No leads match your filter"
            description="Leads automatically sync via Cal.com HMAC-authenticated webhook ingestion."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-600">
              <thead className="bg-neutral-50 text-neutral-700 uppercase font-semibold border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Active Booking</th>
                  <th className="py-3 px-4">UTM Attribution</th>
                  <th className="py-3 px-4">Added</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-neutral-900">{lead.name || 'Unnamed'}</div>
                      <div className="text-neutral-500 font-mono text-[11px]">{lead.email}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-neutral-800">
                      {lead.company || '—'}
                    </td>
                    <td className="py-3 px-4">{getStageBadge(lead.stage)}</td>
                    <td className="py-3 px-4">
                      {lead.activeBooking ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 text-neutral-900 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{lead.activeBooking.title || 'Demo Booking'}</span>
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {new Date(lead.activeBooking.startTime).toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-400">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {lead.utm && Object.keys(lead.utm).length > 0 ? (
                        <div className="space-y-0.5 text-[11px]">
                          {lead.utm.source && (
                            <div>
                              <span className="text-neutral-400">src:</span> {lead.utm.source}
                            </div>
                          )}
                          {lead.utm.campaign && (
                            <div>
                              <span className="text-neutral-400">camp:</span> {lead.utm.campaign}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-neutral-400">Direct</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-neutral-500 text-[11px]">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link
                        href={`${ROUTES.ADMIN.SALES_QUOTE_NEW}?leadId=${encodeURIComponent(lead.id)}`}
                      >
                        <Button
                          variant="primary"
                          size="sm"
                          className="text-xs"
                          leftIcon={<Plus className="w-3.5 h-3.5" />}
                        >
                          Quote
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

