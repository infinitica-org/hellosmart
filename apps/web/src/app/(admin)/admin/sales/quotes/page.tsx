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
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  useToast,
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
  const { toast } = useToast();
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
      toast({
        title: 'Quote Sent',
        description: `Review link successfully sent to ${quote.customerName || 'customer'}.`,
        variant: 'success',
      });
      setTimeout(() => setSentSuccessId(null), 3000);
    } catch (err: any) {
      console.error('Failed to resend quote email', err);
      toast({
        title: 'Failed to Send Quote',
        description: err?.data?.message || err?.message || 'Could not resend quote email: token may not be in active cache.',
        variant: 'error',
      });
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
      <Dialog
        open={Boolean(viewingQuote)}
        onClose={() => setViewingQuote(null)}
        size="lg"
      >
        {viewingQuote && (
          <div>
            <DialogHeader>
              <div className="flex items-center justify-between w-full pr-6">
                <div>
                  <DialogTitle className="font-mono">{viewingQuote.quoteNumber}</DialogTitle>
                  <DialogDescription>
                    Customer: {viewingQuote.customerName || viewingQuote.customerCompany}
                  </DialogDescription>
                </div>
                <div>{getStatusBadge(viewingQuote.status)}</div>
              </div>
            </DialogHeader>

            <DialogContent className="space-y-4">
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
                <div className="flex justify-between text-success">
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
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="py-2 px-3">Item</TableHead>
                          <TableHead className="py-2 px-3">Qty</TableHead>
                          <TableHead className="py-2 px-3 text-right">Unit Price</TableHead>
                          <TableHead className="py-2 px-3 text-right">Line Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {viewingQuote.items.map((it: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="py-2 px-3 font-medium text-neutral-800">{it.productName || it.productCode}</TableCell>
                            <TableCell className="py-2 px-3">{it.quantity}</TableCell>
                            <TableCell className="py-2 px-3 text-right font-mono">
                              {parseFloat(it.unitPrice).toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="py-2 px-3 text-right font-mono font-semibold">
                              {parseFloat(it.lineTotal).toLocaleString('en-IN')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
            </DialogContent>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingQuote(null)}
              >
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </Dialog>

      {/* Main Table Card */}
      <Card className="p-6 space-y-5">
        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="w-full sm:w-72">
            <SearchInput
              size="sm"
              placeholder="Search quote # or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              shortcutKey={false}
              autoShortcut={false}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-3 px-4">Quote Number</TableHead>
                  <TableHead className="py-3 px-4">Customer</TableHead>
                  <TableHead className="py-3 px-4">Classification</TableHead>
                  <TableHead className="py-3 px-4">Grand Total</TableHead>
                  <TableHead className="py-3 px-4">Issued / Expires</TableHead>
                  <TableHead className="py-3 px-4">Status</TableHead>
                  <TableHead className="py-3 px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((q) => (
                  <TableRow key={q.id} className="hover:bg-neutral-50/50 transition-colors">
                    <TableCell className="py-3 px-4">
                      <div className="font-mono font-bold text-neutral-900">{q.quoteNumber}</div>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="font-medium text-neutral-900">{q.customerName || 'Unnamed'}</div>
                      <div className="text-neutral-500 text-[11px]">{q.customerCompany || 'Individual'}</div>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <Badge variant="default" className="text-[10px] uppercase font-mono">
                        {q.taxClassification?.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 px-4 font-mono font-bold text-neutral-900">
                      {q.currency} {parseFloat(q.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-neutral-500 text-[11px]">
                      <div>{new Date(q.createdAt).toLocaleDateString()}</div>
                      <div className="text-neutral-400">Exp: {new Date(q.expiresAt).toLocaleDateString()}</div>
                    </TableCell>
                    <TableCell className="py-3 px-4">{getStatusBadge(q.status)}</TableCell>
                    <TableCell className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
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
                              <Check className="w-3 h-3 text-success" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )
                          }
                        >
                          {sentSuccessId === q.id ? 'Sent' : 'Resend'}
                        </Button>
                      )}
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
