'use client';

import React from 'react';
import Link from 'next/link';
import {
  PageHeader,
  StatCard,
  Button,
  Card,
  Badge,
  Alert,
  EmptyState,
} from '@hs/ui';
import {
  Plus,
  Users,
  Layers,
  CreditCard,
  Briefcase,
  FileText,
  ClipboardCheck,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useGetQuotesQuery, useGetLeadsQuery } from '@/store/admin/adminApi';
import { ROUTES } from '@/constants';

export default function SalesOverviewPage() {
  const {
    data: quotes = [],
    isLoading: isQuotesLoading,
    error: quotesError,
    refetch: refetchQuotes,
  } = useGetQuotesQuery();

  const {
    data: leads = [],
    isLoading: isLeadsLoading,
    error: leadsError,
    refetch: refetchLeads,
  } = useGetLeadsQuery();

  const totalQuotes = quotes.length;
  const pendingApprovals = quotes.filter((q) => q.status === 'issued').length;
  const acceptedQuotes = quotes.filter((q) => q.status === 'accepted').length;
  const totalAcceptedValue = quotes
    .filter((q) => q.status === 'accepted')
    .reduce((sum, q) => sum + (parseFloat(q.grandTotal) || 0), 0);

  const recentQuotes = quotes.slice(0, 5);
  const recentLeads = leads.slice(0, 5);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'issued':
        return <Badge variant="warning">Pending Approval</Badge>;
      case 'accepted':
        return <Badge variant="success">Accepted</Badge>;
      case 'expired':
        return <Badge variant="default">Expired</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

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
    <div className="space-y-8">
      <PageHeader
        title="Sales & Commercial Management"
        description="Monitor sales pipeline, Cal.com bookings, custom commercial quotes, and customer acceptances."
        badge={{ text: 'Commercial', variant: 'info' }}
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refetchQuotes();
                void refetchLeads();
              }}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
            <Link href={ROUTES.ADMIN.SALES_QUOTE_NEW}>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create Quote
              </Button>
            </Link>
          </div>
        }
      />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="Sales Leads"
          value={isLeadsLoading ? '…' : leads.length.toString()}
          description="Inbound Cal.com bookings & leads"
        />
        <StatCard
          label="Total Quotes"
          value={isQuotesLoading ? '…' : totalQuotes.toString()}
          description="Commercial quotations issued"
        />
        <StatCard
          label="Pending Approvals"
          value={isQuotesLoading ? '…' : pendingApprovals.toString()}
          description="Awaiting customer review"
        />
        <StatCard
          label="Accepted Quotes"
          value={isQuotesLoading ? '…' : acceptedQuotes.toString()}
          description={`Approved revenue: INR ${totalAcceptedValue.toLocaleString('en-IN')}`}
        />
      </div>

      {(quotesError || leadsError) && (
        <Alert variant="error" className="text-xs">
          Failed to load some sales data. Please check your network and try refreshing.
        </Alert>
      )}

      {/* Commercial Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Leads & Bookings', href: ROUTES.ADMIN.SALES_LEADS, icon: Users },
          { label: 'Pricing Catalog', href: ROUTES.ADMIN.SALES_CATALOG, icon: Layers },
          { label: 'Promo Codes', href: ROUTES.ADMIN.SALES_PROMOS, icon: CreditCard },
          { label: 'GST Calculator', href: ROUTES.ADMIN.SALES_GST, icon: Briefcase },
          { label: 'Quote Builder', href: ROUTES.ADMIN.SALES_QUOTE_NEW, icon: Plus },
          { label: 'Customer Approvals', href: ROUTES.ADMIN.SALES_APPROVALS, icon: ClipboardCheck },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="p-4 hover:border-primary/50 transition-colors flex flex-col items-center justify-center text-center gap-2 h-full cursor-pointer group">
                <div className="p-2.5 rounded-xl bg-neutral-100 group-hover:bg-primary/10 transition-colors">
                  <Icon className="w-5 h-5 text-neutral-700 group-hover:text-primary transition-colors" />
                </div>
                <span className="text-xs font-semibold text-neutral-800">{item.label}</span>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Grid: Recent Quotes & Recent Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Quotes */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span>Recent Quotations</span>
            </h2>
            <Link
              href={ROUTES.ADMIN.SALES_QUOTES}
              className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
            >
              <span>View all ({totalQuotes})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentQuotes.length === 0 && !isQuotesLoading ? (
            <EmptyState
              title="No quotes issued"
              description="Create your first quote using the Quote Builder."
              action={{
                label: 'Create Quote',
                onClick: () => {
                  window.location.href = ROUTES.ADMIN.SALES_QUOTE_NEW;
                },
              }}
            />
          ) : (
            <div className="divide-y divide-neutral-100">
              {recentQuotes.map((q) => (
                <div key={q.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-neutral-900">
                        {q.quoteNumber}
                      </span>
                      {getStatusBadge(q.status)}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      {q.customerName || q.customerCompany || 'Customer'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-semibold text-neutral-900">
                      {q.currency} {parseFloat(q.grandTotal).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-neutral-400">
                      {new Date(q.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Leads */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span>Cal.com Sales Leads</span>
            </h2>
            <Link
              href={ROUTES.ADMIN.SALES_LEADS}
              className="text-xs text-primary font-medium flex items-center gap-1 hover:underline"
            >
              <span>View all ({leads.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentLeads.length === 0 && !isLeadsLoading ? (
            <EmptyState
              title="No sales leads recorded"
              description="Leads from Cal.com booking webhooks will appear here automatically."
            />
          ) : (
            <div className="divide-y divide-neutral-100">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-neutral-900 truncate">
                        {lead.name || lead.email}
                      </span>
                      {getStageBadge(lead.stage)}
                    </div>
                    <div className="text-xs text-neutral-500 truncate">
                      {lead.company ? `${lead.company} • ` : ''}{lead.email}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Link
                      href={`${ROUTES.ADMIN.SALES_QUOTE_NEW}?leadId=${encodeURIComponent(lead.id)}`}
                    >
                      <Button variant="outline" size="sm" className="text-xs">
                        Build Quote
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
