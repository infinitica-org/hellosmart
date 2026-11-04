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
import {
  Search,
  Plus,
  Send,
  Copy,
  Check,
  Eye,
  RefreshCw,
  FileText,
} from 'lucide-react';
import {
  useGetQuotesQuery,
  useSendQuoteEmailMutation,
} from '@/store/admin/adminApi';
import { ROUTES } from '@/constants';

export default function SentQuotesPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewingQuote, setViewingQuote] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentSuccessId, setSentSuccessId] = useState<string | null>(null);

  const { data: quotes = [], isLoading, refetch } = useGetQuotesQuery();
  const [sendQuoteEmail] = useSendQuoteEmailMutation();

  const filteredQuotes = quotes.filter((q) => {
    const matchesSearch =
      !search ||
      q.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
      (q.customerName && q.customerName.toLowerCase().includes(search.toLowerCase())) ||
      (q.customerCompany && q.customerCompany.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleResend = async (quote: any) => {
    setSendingId(quote.id);
    setSentSuccessId(null);
    try {
      await sendQuoteEmail({ quoteId: quote.id }).unwrap();
      setSentSuccessId(quote.id);
      setTimeout(() => setSentSuccessId(null), 3000);
    } catch (err) {
      console.error('Failed to resend quote email', err);
      alert('Could not resend quote email: token may not be in active cache.');
    } finally {
      setSendingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'issued':
        return <Badge variant="warning">Issued (Pending)</Badge>;
      case 'accepted':
        return <Badge variant="success">Accepted</Badge>;
      case 'expired':
        return <Badge variant="default">Expired</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sent Commercial Quotations"
        description="View and track issued quotes, resend review links to customers, and inspect financial snapshots."
        badge={{ text: 'Commercial', variant: 'info' }}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
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
                New Quote
              </Button>
            </Link>
          </div>
        }
      />

      {/* Quote Details Modal */}
      {viewingQuote && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-900 font-mono">
                  {viewingQuote.quoteNumber}
                </h2>
                <div className="text-xs text-neutral-500">
                  Customer: {viewingQuote.customerName || viewingQuote.customerCompany}
                </div>
              </div>
              <div>{getStatusBadge(viewingQuote.status)}</div>
            </div>

            {/* Financial Details */}
            <div className="bg-neutral-50 rounded-xl p-4 space-y-2 text-xs">
              <div className="font-semibold text-neutral-900 pb-1 border-b border-neutral-200">
                Financial Snapshot Breakdown
              </div>
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-mono">
                  {viewingQuote.currency} {parseFloat(viewingQuote.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>Discount Total:</span>
                <span className="font-mono">
                  - {viewingQuote.currency} {parseFloat(viewingQuote.discountTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Taxable Amount:</span>
                <span className="font-mono">
                  {viewingQuote.currency} {parseFloat(viewingQuote.taxableAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>Statutory 18% GST ({viewingQuote.taxClassification}):</span>
                <span className="font-mono">
                  {viewingQuote.currency} {parseFloat(viewingQuote.taxTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t border-neutral-200 pt-2 flex justify-between font-bold text-neutral-900 text-sm">
                <span>Grand Total:</span>
                <span className="font-mono text-primary">
                  {viewingQuote.currency} {parseFloat(viewingQuote.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Line Items */}
            {viewingQuote.items && viewingQuote.items.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-neutral-800">Purchased Offerings</div>
                <div className="border border-neutral-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-neutral-100 text-neutral-600">
                      <tr>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3">Qty</th>
                        <th className="py-2 px-3 text-right">Unit Price</th>
                        <th className="py-2 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {viewingQuote.items.map((it: any, i: number) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-medium text-neutral-800">{it.productName || it.productCode}</td>
                          <td className="py-2 px-3">{it.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {parseFloat(it.unitPrice).toLocaleString('en-IN')}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">
                            {parseFloat(it.lineTotal).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Jurisdiction */}
            <div className="text-[11px] text-neutral-500 bg-neutral-50 p-3 rounded-lg flex justify-between">
              <div>
                <span className="font-semibold text-neutral-700">Customer State:</span>{' '}
                {viewingQuote.customerJurisdiction?.state || 'N/A'} (Country: {viewingQuote.customerJurisdiction?.country})
              </div>
              {viewingQuote.customerJurisdiction?.gstin && (
                <div>
                  <span className="font-semibold text-neutral-700">GSTIN:</span> {viewingQuote.customerJurisdiction.gstin}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingQuote(null)}
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Main Table Card */}
      <Card className="p-6 space-y-5">
        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="w-full sm:w-72">
            <Input
              size="sm"
              placeholder="Search quote # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={search ? () => setSearch('') : undefined}
              leftIcon={<Search className="w-4 h-4 text-neutral-400" />}
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto bg-neutral-100 p-1 rounded-xl text-xs">
            {['all', 'issued', 'accepted', 'expired'].map((st) => (
              <Button
                key={st}
                type="button"
                variant={statusFilter === st ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter(st)}
                className="capitalize text-xs px-2.5 py-1"
              >
                {st}
              </Button>
            ))}
          </div>
        </div>

        {filteredQuotes.length === 0 && !isLoading ? (
          <EmptyState
            title="No quotations found"
            description="Generate commercial quotations using the Quote Builder."
            action={{
              label: 'Create First Quote',
              onClick: () => {
                window.location.href = ROUTES.ADMIN.SALES_QUOTE_NEW;
              },
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-600">
              <thead className="bg-neutral-50 text-neutral-700 uppercase font-semibold border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4">Quote Number</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Classification</th>
                  <th className="py-3 px-4">Grand Total</th>
                  <th className="py-3 px-4">Issued / Expires</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredQuotes.map((q) => (
                  <tr key={q.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-neutral-900">{q.quoteNumber}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-neutral-900">{q.customerName || 'Unnamed'}</div>
                      <div className="text-neutral-500 text-[11px]">{q.customerCompany || 'Individual'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="default" className="text-[10px] uppercase font-mono">
                        {q.taxClassification?.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-neutral-900">
                      {q.currency} {parseFloat(q.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-neutral-500 text-[11px]">
                      <div>{new Date(q.createdAt).toLocaleDateString()}</div>
                      <div className="text-neutral-400">Exp: {new Date(q.expiresAt).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(q.status)}</td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingQuote(q)}
                        className="text-neutral-600 hover:text-neutral-900 p-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>

                      {q.status === 'issued' && (
                        <Button
                          variant={sentSuccessId === q.id ? 'outline' : 'primary'}
                          size="sm"
                          className="text-xs"
                          onClick={() => void handleResend(q)}
                          isLoading={sendingId === q.id}
                          leftIcon={
                            sentSuccessId === q.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )
                          }
                        >
                          {sentSuccessId === q.id ? 'Sent' : 'Resend'}
                        </Button>
                      )}
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
