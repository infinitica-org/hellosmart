'use client';

import React, { use, useEffect, useState } from 'react';
import type { CustomerQuoteDto } from '@hs/contracts';
import { getQuoteByToken, acceptQuote, ApiError } from '@/lib/api-client';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Alert,
  Separator,
} from '@hs/ui';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Printer,
  ShieldCheck,
  Building2,
  Calendar,
  Check,
} from 'lucide-react';

interface QuoteReviewPageProps {
  params: Promise<{ token: string }>;
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency === 'INR' ? 'INR' : 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function formatDateTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return isoString;
  }
}

export default function CustomerQuoteReviewPage({ params }: QuoteReviewPageProps): React.JSX.Element {
  const { token } = use(params);

  const [quote, setQuote] = useState<CustomerQuoteDto | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  // Approval state
  const [signatoryName, setSignatoryName] = useState<string>('');
  const [termsAgreed, setTermsAgreed] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [approvalSuccess, setApprovalSuccess] = useState<boolean>(false);
  const [approvalMessage, setApprovalMessage] = useState<string>('');

  useEffect(() => {
    let isMounted = true;

    async function loadQuote() {
      setIsLoading(true);
      setError(null);
      try {
        const fetchedQuote = await getQuoteByToken(token);
        if (isMounted) {
          setQuote(fetchedQuote);
          if (fetchedQuote.customerName && !signatoryName) {
            setSignatoryName(fetchedQuote.customerName);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          if (err instanceof ApiError) {
            setError({ code: err.code, message: err.message });
          } else {
            setError({
              code: 'FETCH_ERROR',
              message: err?.message || 'Failed to load quotation. Please check your network and try again.',
            });
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadQuote();

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleApprove = async () => {
    if (!termsAgreed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await acceptQuote(token, {
        acceptedByName: signatoryName.trim() || undefined,
        confirmationAcknowledged: true,
      });

      setQuote(response.quote);
      setApprovalSuccess(true);
      setApprovalMessage(response.message || 'Quotation accepted successfully.');
      setShowConfirmModal(false);
    } catch (err: any) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert('An unexpected error occurred while accepting the quote. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4" role="status" aria-label="Loading quote">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-neutral-600">Loading commercial quotation...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg border-neutral-200">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
              <AlertCircle className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-bold text-neutral-900">
              {error?.code === 'QUOTE_NOT_FOUND' ? 'Quotation Not Found' : 'Unable to Display Quotation'}
            </CardTitle>
            <CardDescription className="text-neutral-600 text-sm mt-1">
              {error?.message || 'This quotation link is invalid or may have expired.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-xs text-neutral-500 pt-2 pb-6">
            If you believe this is an error, please reach out directly to your HelloSmart account representative.
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAccepted = quote.status === 'accepted' || approvalSuccess;
  const isExpired = quote.status === 'expired';
  const isRejected = quote.status === 'rejected';
  const isSuperseded = quote.status === 'superseded';
  const canApprove = quote.status === 'issued' && !isAccepted;

  return (
    <div className="min-h-screen bg-neutral-50 py-8 px-4 sm:px-6 lg:px-8 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Status Banners */}
        {isAccepted && (
          <Alert variant="success" title="Quotation Approved" className="shadow-sm print:hidden">
            <p className="text-emerald-700 text-sm mt-0.5">
              {approvalMessage || 'This commercial quote has been accepted.'}{' '}
              {quote.acceptedAt && (
                <span>
                  Approved on <strong>{formatDateTime(quote.acceptedAt)}</strong>
                  {quote.acceptedByName && <span> by <strong>{quote.acceptedByName}</strong></span>}.
                </span>
              )}
            </p>
          </Alert>
        )}

        {isExpired && (
          <Alert variant="warning" title="Quotation Expired" className="shadow-sm print:hidden">
            <p className="text-amber-700 text-sm mt-0.5">
              This quotation expired on {formatDate(quote.expiresAt)} and can no longer be accepted. Please contact sales for an updated quote.
            </p>
          </Alert>
        )}

        {isRejected && (
          <Alert variant="error" title="Quotation Declined" className="shadow-sm print:hidden">
            <p className="text-danger-foreground text-sm mt-0.5">
              This commercial quotation was marked as declined.
            </p>
          </Alert>
        )}

        {isSuperseded && (
          <Alert variant="info" title="Quotation Superseded" className="shadow-sm print:hidden">
            <p className="text-neutral-600 text-sm mt-0.5">
              This quotation has been superseded by a newer version. Please refer to the latest quotation link sent by your sales representative.
            </p>
          </Alert>
        )}

        {/* Main Quote Card */}
        <Card className="bg-white border-neutral-200 shadow-md print:shadow-none print:border-none">
          {/* Header */}
          <CardHeader className="border-b border-neutral-100 pb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-black tracking-tight text-neutral-900 font-serif">HelloSmart<span className="text-primary font-sans">.ai</span></span>
                  <Badge variant="default" className="ml-2 uppercase tracking-wide text-xs">
                    Commercial Quote
                  </Badge>
                </div>
                <p className="text-xs text-neutral-500 mt-1">AI-Native Candidate Evaluation Platform</p>
              </div>

              <div className="text-left sm:text-right flex flex-col sm:items-end">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-semibold text-neutral-700">Ref:</span>
                  <span className="text-sm font-mono font-bold text-neutral-900">{quote.quoteNumber}</span>
                </div>
                <div className="mt-1">
                  {quote.status === 'issued' && <Badge className="bg-blue-600 text-white hover:bg-blue-600">Pending Approval</Badge>}
                  {quote.status === 'accepted' && <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Accepted</Badge>}
                  {quote.status === 'expired' && <Badge className="bg-neutral-500 text-white hover:bg-neutral-500">Expired</Badge>}
                  {quote.status === 'rejected' && <Badge className="bg-red-600 text-white hover:bg-red-600">Declined</Badge>}
                  {quote.status === 'superseded' && <Badge className="bg-neutral-400 text-white hover:bg-neutral-400">Superseded</Badge>}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-8">
            {/* Parties & Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              {/* Issued To */}
              <div className="space-y-1.5 p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                <div className="flex items-center text-neutral-500 font-semibold text-xs uppercase tracking-wider">
                  <Building2 className="w-3.5 h-3.5 mr-1" />
                  Prepared For
                </div>
                <p className="font-bold text-neutral-900 text-base">
                  {quote.companyName || quote.customerName || 'Valued Customer'}
                </p>
                {quote.customerName && quote.companyName && (
                  <p className="text-neutral-700 text-xs">Attn: {quote.customerName}</p>
                )}
                {quote.customerJurisdiction && (
                  <div className="text-xs text-neutral-600 pt-1">
                    <p>{quote.customerJurisdiction.city ? `${quote.customerJurisdiction.city}, ` : ''}{quote.customerJurisdiction.state || ''} {quote.customerJurisdiction.pinCode || ''}</p>
                    <p>{quote.customerJurisdiction.country}</p>
                    {quote.customerJurisdiction.gstin && (
                      <p className="font-mono text-neutral-800 font-medium mt-0.5">GSTIN: {quote.customerJurisdiction.gstin}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Issued By */}
              <div className="space-y-1.5 p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                <div className="flex items-center text-neutral-500 font-semibold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Issued By
                </div>
                <p className="font-bold text-neutral-900">HelloSmart AI</p>
                {quote.sellerJurisdiction && (
                  <div className="text-xs text-neutral-600">
                    <p>{quote.sellerJurisdiction.city ? `${quote.sellerJurisdiction.city}, ` : ''}{quote.sellerJurisdiction.state || ''} {quote.sellerJurisdiction.pinCode || ''}</p>
                    <p>{quote.sellerJurisdiction.country}</p>
                    {quote.sellerJurisdiction.gstin && (
                      <p className="font-mono text-neutral-800 font-medium mt-0.5">GSTIN: {quote.sellerJurisdiction.gstin}</p>
                    )}
                  </div>
                )}
                <p className="text-xs text-neutral-500 pt-1">Billing & Commercial Operations</p>
              </div>

              {/* Dates & Terms */}
              <div className="space-y-1.5 p-3 rounded-lg bg-neutral-50 border border-neutral-100">
                <div className="flex items-center text-neutral-500 font-semibold text-xs uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5 mr-1" />
                  Quote Details
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span className="text-neutral-500">Issued Date:</span>
                  <span className="font-medium text-neutral-900 text-right">{formatDate(quote.issuedAt)}</span>

                  <span className="text-neutral-500">Valid Until:</span>
                  <span className="font-medium text-neutral-900 text-right">{formatDate(quote.expiresAt)}</span>

                  <span className="text-neutral-500">Currency:</span>
                  <span className="font-bold text-neutral-900 text-right">{quote.currency}</span>

                  <span className="text-neutral-500">Tax Type:</span>
                  <span className="font-medium text-neutral-900 text-right capitalize">
                    {quote.taxClassification === 'intra_state' ? 'Intra-State GST (18%)' :
                     quote.taxClassification === 'inter_state' ? 'Inter-State IGST (18%)' :
                     quote.taxClassification === 'export' ? 'Zero-Rated Export' : 'Exempt'}
                  </span>
                </div>
              </div>
            </div>

            {/* Line Items Table */}
            <div>
              <div className="mb-2">
                <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wider">Itemized Services & Pricing</h3>
              </div>
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-neutral-50">
                    <TableRow>
                      <TableHead className="w-2/5">Service / Product</TableHead>
                      <TableHead className="text-center">Billing</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      {quote.discountTotal > 0 && <TableHead className="text-right">Discount</TableHead>}
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quote.lines.map((line: any) => (
                      <TableRow key={line.id} className="hover:bg-neutral-50/50">
                        <TableCell>
                          <div className="font-semibold text-neutral-900">{line.productName}</div>
                          {line.description && (
                            <div className="text-xs text-neutral-500 mt-0.5">{line.description}</div>
                          )}
                          <div className="text-[10px] text-neutral-400 font-mono mt-0.5">Code: {line.productCode}</div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="default" className="text-xs capitalize font-normal">
                            {line.billingType === 'recurring' ? `${line.billingInterval || ''} recurring` : 'One-time'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatCurrency(line.unitPrice, quote.currency)}
                        </TableCell>
                        <TableCell className="text-center font-semibold text-sm">
                          {line.quantity}
                        </TableCell>
                        {quote.discountTotal > 0 && (
                          <TableCell className="text-right font-mono text-sm text-emerald-600">
                            {line.discountAmount > 0 ? `-${formatCurrency(line.discountAmount, quote.currency)}` : '—'}
                          </TableCell>
                        )}
                        <TableCell className="text-right font-mono font-semibold text-neutral-900 text-sm">
                          {formatCurrency(line.lineTotal, quote.currency)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Financial Summary & GST Breakdown */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pt-2">
              <div className="w-full sm:w-1/2 space-y-3">
                {quote.notes && (
                  <div className="p-3 bg-neutral-50 border border-neutral-100 rounded-lg">
                    <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wider mb-1">Notes & Instructions</p>
                    <p className="text-xs text-neutral-600 whitespace-pre-line">{quote.notes}</p>
                  </div>
                )}
                <div className="text-xs text-neutral-500 space-y-1">
                  <p>• Prices quoted are valid until {formatDate(quote.expiresAt)}.</p>
                  <p>• Goods and Services Tax (GST) applied according to Indian tax regulations.</p>
                  <p>• Access to HelloSmart assessment workspaces will be provisioned upon confirmation.</p>
                </div>
              </div>

              {/* Total Calculation Card */}
              <div className="w-full sm:w-1/2 bg-neutral-50 border border-neutral-200 rounded-lg p-4 space-y-2.5">
                <div className="flex justify-between text-sm text-neutral-600">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatCurrency(quote.subtotal, quote.currency)}</span>
                </div>

                {quote.discountTotal > 0 && (
                  <div className="flex justify-between text-sm text-emerald-700 font-medium">
                    <span>Promotional Discount</span>
                    <span className="font-mono">-{formatCurrency(quote.discountTotal, quote.currency)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm text-neutral-700 font-semibold border-t border-neutral-200 pt-2">
                  <span>Taxable Amount</span>
                  <span className="font-mono">{formatCurrency(quote.taxableAmount, quote.currency)}</span>
                </div>

                {/* 18% GST Breakdown */}
                {quote.taxClassification === 'intra_state' ? (
                  <>
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>Central GST (CGST 9%)</span>
                      <span className="font-mono">{formatCurrency(quote.cgstTotal, quote.currency)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-500">
                      <span>State GST (SGST 9%)</span>
                      <span className="font-mono">{formatCurrency(quote.sgstTotal, quote.currency)}</span>
                    </div>
                  </>
                ) : quote.taxClassification === 'inter_state' ? (
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>Integrated GST (IGST 18%)</span>
                    <span className="font-mono">{formatCurrency(quote.igstTotal, quote.currency)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between text-xs text-neutral-500">
                    <span>GST (Zero-rated / Exempt)</span>
                    <span className="font-mono">{formatCurrency(0, quote.currency)}</span>
                  </div>
                )}

                <Separator className="my-2" />

                <div className="flex justify-between items-baseline text-base font-bold text-neutral-900">
                  <span>Total Payable Amount</span>
                  <span className="text-xl font-mono text-primary font-black">
                    {formatCurrency(quote.grandTotal, quote.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* One-Click Approval Action Area */}
            {canApprove && (
              <div className="mt-8 pt-6 border-t border-neutral-200 print:hidden">
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 space-y-5">
                  <div>
                    <h3 className="text-base font-bold text-neutral-900">Approve Quotation</h3>
                    <p className="text-xs text-neutral-600 mt-1">
                      Please confirm your name and agree to the commercial terms below to approve this quotation.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="signatory-name" className="block text-xs font-semibold text-neutral-700 mb-1">
                        Authorized Signatory Full Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="signatory-name"
                        type="text"
                        value={signatoryName}
                        onChange={(e) => setSignatoryName(e.target.value)}
                        placeholder="e.g. Jane Doe"
                        className="w-full px-3 py-2 text-sm bg-white border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 pt-1">
                    <input
                      id="terms-agree"
                      type="checkbox"
                      checked={termsAgreed}
                      onChange={(e) => setTermsAgreed(e.target.checked)}
                      className="h-4 w-4 text-primary focus:ring-primary border-neutral-300 rounded mt-0.5"
                    />
                    <label htmlFor="terms-agree" className="text-xs text-neutral-700 leading-normal">
                      I confirm that I am authorized to accept this quotation on behalf of{' '}
                      <strong>{quote.companyName || quote.customerName || 'the customer organization'}</strong>, and agree to the pricing and commercial terms set forth above.
                    </label>
                  </div>

                  <div className="pt-2 flex items-center space-x-4">
                    <Button
                      onClick={() => setShowConfirmModal(true)}
                      disabled={!termsAgreed || !signatoryName.trim() || isSubmitting}
                      className="px-6 py-2.5 bg-primary text-white font-semibold rounded-lg shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Approve & Accept Quotation
                    </Button>
                    <span className="text-xs text-neutral-400">One-click immediate confirmation</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          {/* Footer Actions */}
          <CardFooter className="border-t border-neutral-100 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 print:hidden">
            <p className="text-xs text-neutral-400">
              Need assistance? Email billing@hellosmart.ai or contact your sales representative.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="text-xs flex items-center space-x-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm print:hidden">
          <Card className="max-w-md w-full bg-white shadow-2xl border-neutral-200 animate-in fade-in zoom-in-95 duration-150">
            <CardHeader>
              <div className="flex items-center space-x-2 text-primary">
                <ShieldCheck className="w-5 h-5" />
                <CardTitle className="text-lg font-bold">Confirm Quotation Acceptance</CardTitle>
              </div>
              <CardDescription className="text-xs text-neutral-600 mt-1">
                Please verify that you wish to approve this commercial quotation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-100 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Quotation Ref:</span>
                  <span className="font-mono font-bold text-neutral-900">{quote.quoteNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Total Payable:</span>
                  <span className="font-mono font-bold text-primary">{formatCurrency(quote.grandTotal, quote.currency)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Signatory:</span>
                  <span className="font-medium text-neutral-900">{signatoryName}</span>
                </div>
              </div>
              <p className="text-xs text-neutral-600">
                Approving this quotation forms a commercial agreement with HelloSmart.ai under the specified pricing and validity terms.
              </p>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2 pt-2 border-t border-neutral-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={isSubmitting}
                className="bg-primary text-white hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <span className="flex items-center space-x-2">
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing...</span>
                  </span>
                ) : (
                  <span>Confirm Approval</span>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
