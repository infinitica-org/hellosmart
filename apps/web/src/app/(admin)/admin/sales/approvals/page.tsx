'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  PageHeader,
  Card,
  SearchInput,
  Button,
  Badge,
  EmptyState,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@hs/ui';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { useGetQuotesQuery } from '@/store/admin/adminApi';

export default function CustomerApprovalsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'pending' | 'accepted' | 'expired'>('accepted');

  const { data: quotes = [], isLoading, refetch } = useGetQuotesQuery();

  const filteredQuotes = quotes.filter((q) => {
    const matchesSearch =
      !search ||
      q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
      (q.customerName && q.customerName.toLowerCase().includes(search.toLowerCase())) ||
      (q.acceptedByName && q.acceptedByName.toLowerCase().includes(search.toLowerCase()));

    if (filter === 'pending') return matchesSearch && q.status === 'issued';
    if (filter === 'accepted') return matchesSearch && q.status === 'accepted';
    if (filter === 'expired') return matchesSearch && q.status === 'expired';
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'issued':
        return <Badge variant="warning">Awaiting Approval</Badge>;
      case 'accepted':
        return <Badge variant="success">Approved</Badge>;
      case 'expired':
        return <Badge variant="default">Expired</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Quote Approvals"
        description="Audit-grade tracker for one-click customer approvals, signatory evidence, timestamps, and statutory GST acceptance."
        badge={{ text: 'Approvals', variant: 'info' }}
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
        {/* Search & Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="w-full sm:w-72">
            <SearchInput
              size="sm"
              placeholder="Search quote # or signatory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              shortcutKey={false}
              autoShortcut={false}
            />
          </div>

          <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-xl text-xs">
            <Button
              type="button"
              variant={filter === 'accepted' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('accepted')}
              className="text-xs px-3 py-1 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approved Quotes ({quotes.filter((q) => q.status === 'accepted').length})</span>
            </Button>

            <Button
              type="button"
              variant={filter === 'pending' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('pending')}
              className="text-xs px-3 py-1 flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pending Review ({quotes.filter((q) => q.status === 'issued').length})</span>
            </Button>

            <Button
              type="button"
              variant={filter === 'expired' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilter('expired')}
              className="text-xs px-3 py-1 flex items-center gap-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Expired ({quotes.filter((q) => q.status === 'expired').length})</span>
            </Button>
          </div>
        </div>

        {filteredQuotes.length === 0 && !isLoading ? (
          <EmptyState
            title={`No ${filter} quotes`}
            description={
              filter === 'accepted'
                ? 'Quotes accepted by customers through one-click review will appear here.'
                : 'No quotes currently match this filter.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-3 px-4">Quote Number</TableHead>
                  <TableHead className="py-3 px-4">Customer</TableHead>
                  <TableHead className="py-3 px-4">Amount (incl. GST)</TableHead>
                  <TableHead className="py-3 px-4">Approval Status</TableHead>
                  <TableHead className="py-3 px-4">Signatory Evidence</TableHead>
                  <TableHead className="py-3 px-4">Accepted Timestamp</TableHead>
                  <TableHead className="py-3 px-4 text-right">Audit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((q) => (
                  <TableRow key={q.id} className="hover:bg-neutral-50/50 transition-colors">
                    <TableCell className="py-3 px-4 font-mono font-bold text-neutral-900">
                      {q.quoteNumber}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="font-medium text-neutral-900">{q.customerName || 'Unnamed'}</div>
                      <div className="text-neutral-500 text-[11px]">{q.customerCompany || 'Individual'}</div>
                    </TableCell>
                    <TableCell className="py-3 px-4 font-mono font-semibold text-neutral-900">
                      {q.currency} {parseFloat(q.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-3 px-4">{getStatusBadge(q.status)}</TableCell>
                    <TableCell className="py-3 px-4">
                      {q.acceptedByName ? (
                        <div className="space-y-0.5">
                          <div className="font-medium text-neutral-900">{q.acceptedByName}</div>
                          <div className="text-[10px] text-neutral-400 font-mono">
                            IP: {q.acceptedByIp || 'Unverified (boundary safe)'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-neutral-400 italic">Pending signature</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-neutral-500 text-[11px]">
                      {q.acceptedAt ? (
                        <div className="font-mono text-success">
                          {new Date(q.acceptedAt).toLocaleString()}
                        </div>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <span className="inline-flex items-center gap-1 font-mono text-[10px] bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded border border-neutral-200">
                        <ShieldCheck className="w-3 h-3 text-success" />
                        <span>Audit Log</span>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
