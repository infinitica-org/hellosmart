'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PageHeader,
  Card,
  Input,
  Button,
  Badge,
  Alert,
  TextField,
  SelectField,
  SearchInput,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
} from '@hs/ui';
import {
  Plus,
  Trash2,
  Send,
  Copy,
  Check,
  FileText,
  Calculator,
  ExternalLink,
  Search,
  X,
  Tag,
  Percent,
} from 'lucide-react';
import {
  useGetLeadsQuery,
  useGetPricingCatalogQuery,
  useGetPromoCodesQuery,
  useCreateQuoteMutation,
  useSendQuoteEmailMutation,
  useCalculateGstMutation,
} from '@/store/admin/adminApi';
import { ROUTES } from '@/constants';

interface SelectedProduct {
  catalogProductId: string;
  quantity: number;
}

export default function QuoteBuilderPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preselectedLeadId = searchParams.get('leadId') || '';

  const [leadId, setLeadId] = useState(preselectedLeadId);
  const [customerSearch, setCustomerSearch] = useState('');
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [customerState, setCustomerState] = useState('KA');
  const [customerCity, setCustomerCity] = useState('Bengaluru');
  const [customerPin, setCustomerPin] = useState('560001');
  const [customerGstin, setCustomerGstin] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [notes, setNotes] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('14');

  const [selectedItems, setSelectedItems] = useState<SelectedProduct[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Success modal state
  const [createdResult, setCreatedResult] = useState<{
    quote: any;
    publicToken: string;
    publicUrl: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const { data: leads = [], isLoading: isLeadsLoading } = useGetLeadsQuery();
  const { data: catalog = [], isLoading: isCatalogLoading } = useGetPricingCatalogQuery({
    isActive: true,
  });
  const { data: promoCodes = [] } = useGetPromoCodesQuery();

  const [createQuote, { isLoading: isCreating }] = useCreateQuoteMutation();
  const [sendQuoteEmail, { isLoading: isSendingEmail }] = useSendQuoteEmailMutation();
  const [calculateGst, { data: liveTaxResult }] = useCalculateGstMutation();

  // Populate first catalog item if empty
  useEffect(() => {
    if (catalog.length > 0 && selectedItems.length === 0) {
      setSelectedItems([{ catalogProductId: catalog[0].id, quantity: 1 }]);
    }
  }, [catalog, selectedItems.length]);

  // Set lead ID if search param was supplied
  useEffect(() => {
    if (preselectedLeadId && !leadId) {
      setLeadId(preselectedLeadId);
    }
  }, [preselectedLeadId, leadId]);

  // Filter leads based on customer search input
  const filteredLeads = leads.filter((lead) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return (
      (lead.name && lead.name.toLowerCase().includes(q)) ||
      (lead.email && lead.email.toLowerCase().includes(q)) ||
      (lead.company && lead.company.toLowerCase().includes(q))
    );
  });

  const selectedLead = leads.find((l) => l.id === leadId);

  // Calculate live subtotal
  const lineDetails = selectedItems.map((sel) => {
    const product = catalog.find((p) => p.id === sel.catalogProductId);
    const unitPrice = product ? parseFloat(product.unitPrice) : 0;
    const lineTotal = unitPrice * sel.quantity;
    return {
      product,
      quantity: sel.quantity,
      unitPrice,
      lineTotal,
    };
  });

  const subtotal = lineDetails.reduce((sum, item) => sum + item.lineTotal, 0);

  // Check matching promo code and compute live discount
  const matchedPromo = promoCodes.find(
    (p) => p.code.trim().toUpperCase() === promoCode.trim().toUpperCase() && p.isActive
  );

  let discountAmount = 0;
  if (matchedPromo && subtotal > 0) {
    const val = parseFloat(matchedPromo.discountValue);
    if (matchedPromo.discountType === 'percentage') {
      discountAmount = Math.round(((subtotal * val) / 100) * 100) / 100;
    } else if (matchedPromo.discountType === 'fixed') {
      discountAmount = Math.min(subtotal, val);
    }
  }

  const taxableAmount = Math.max(0, subtotal - discountAmount);

  // Trigger tax preview whenever pricing or jurisdiction changes
  useEffect(() => {
    if (lineDetails.length > 0 && subtotal > 0) {
      void calculateGst({
        currency,
        customerJurisdiction: {
          country: 'IN',
          state: customerState,
          city: customerCity,
          pinCode: customerPin,
        },
        lines: [
          {
            lineSubtotal: subtotal,
            discountAmount,
          },
        ],
      });
    }
  }, [subtotal, discountAmount, customerState, currency, customerCity, customerPin]);

  const handleAddItem = () => {
    if (catalog.length === 0) return;
    setSelectedItems((prev) => [...prev, { catalogProductId: catalog[0].id, quantity: 1 }]);
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, catalogProductId: string, quantity: number) => {
    setSelectedItems((prev) =>
      prev.map((item, i) =>
        i === index ? { catalogProductId, quantity: Math.max(1, quantity) } : item
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!leadId) {
      setFormError('Please select a customer sales lead.');
      return;
    }

    if (selectedItems.length === 0) {
      setFormError('Please select at least one product line item.');
      return;
    }

    try {
      const response = await createQuote({
        leadId,
        currency,
        customerJurisdiction: {
          country: 'IN',
          state: customerState,
          city: customerCity || undefined,
          pinCode: customerPin || undefined,
          gstin: customerGstin.trim() || undefined,
        },
        items: selectedItems.map((item) => ({
          catalogProductId: item.catalogProductId,
          quantity: item.quantity,
        })),
        promoCode: promoCode.trim().toUpperCase() || undefined,
        notes: notes.trim() || undefined,
        expiresInDays: parseInt(expiresInDays, 10) || 14,
      }).unwrap();

      setCreatedResult(response);
      setEmailSent(false);
      setEmailError(null);
    } catch (err: any) {
      setFormError(err?.data?.detail || err?.message || 'Failed to create quotation.');
    }
  };

  const handleSendEmail = async () => {
    if (!createdResult) return;
    setEmailError(null);
    try {
      await sendQuoteEmail({
        quoteId: createdResult.quote.id,
        publicToken: createdResult.publicToken,
        recipientEmail: createdResult.quote.customerEmail || selectedLead?.email || undefined,
      }).unwrap();
      setEmailSent(true);
    } catch (err: any) {
      console.error('Failed to send quote review email', err);
      setEmailError(err?.data?.detail || err?.message || 'Failed to dispatch email. Check backend connectivity.');
    }
  };

  const handleCopyLink = () => {
    if (!createdResult) return;
    const fullUrl = `${window.location.origin}${createdResult.publicUrl}`;
    void navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Commercial Quote Builder"
        description="Select customer, add products, apply promo discounts, compute statutory GST, and issue immutable quotations."
        badge={{ text: 'Builder', variant: 'info' }}
      />

      {/* Quote Created Success Modal */}
      <Dialog
        open={Boolean(createdResult)}
        onClose={() => {
          setCreatedResult(null);
          setEmailSent(false);
          setEmailError(null);
        }}
        size="md"
      >
        {createdResult && (
          <div>
            <DialogHeader>
              <div className="flex items-center gap-2 text-success">
                <Check className="w-5 h-5 rounded-full bg-success/15 p-0.5" />
                <DialogTitle>Quotation Created Successfully</DialogTitle>
              </div>
              <DialogDescription>
                Commercial quote has been generated with server-side tax classification.
              </DialogDescription>
            </DialogHeader>

            <DialogContent className="space-y-4">
              <div className="bg-neutral-50 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Quote Number:</span>
                  <span className="font-mono font-bold text-neutral-900">{createdResult.quote.quoteNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Customer:</span>
                  <span className="font-medium text-neutral-800">
                    {createdResult.quote.customerName || createdResult.quote.customerCompany || selectedLead?.name || selectedLead?.email}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Recipient Email:</span>
                  <span className="font-mono text-neutral-700">
                    {createdResult.quote.customerEmail || selectedLead?.email}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Grand Total (incl. GST):</span>
                  <span className="font-mono font-bold text-primary text-sm">
                    {createdResult.quote.currency} {parseFloat(createdResult.quote.grandTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Public Review Link */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-700">Customer Review URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}${createdResult.publicUrl}`}
                    className="w-full text-xs font-mono bg-neutral-100 border border-neutral-300 rounded-lg p-2 text-neutral-700 truncate"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLink}
                    leftIcon={copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <a
                    href={createdResult.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="ghost" size="sm" leftIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                      Open
                    </Button>
                  </a>
                </div>
              </div>

              {/* Email Dispatch Feedback */}
              {emailError && (
                <Alert variant="error" className="text-xs">
                  {emailError}
                </Alert>
              )}

              {emailSent && (
                <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-xs text-success-foreground space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Check className="w-4 h-4 text-success" />
                    <span>Email Dispatched to Mailpit!</span>
                  </div>
                  <p className="text-[11px] text-neutral-600">
                    Customer quote notification was delivered. View and inspect the email live in Mailpit:{' '}
                    <a
                      href="http://localhost:8025"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-mono text-primary font-bold inline-flex items-center gap-0.5"
                    >
                      http://localhost:8025 <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </div>
              )}
            </DialogContent>

            <DialogFooter>
              <div className="w-full flex items-center justify-between">
                <Link href={ROUTES.ADMIN.SALES_QUOTES}>
                  <Button variant="ghost" size="sm">
                    View All Quotes
                  </Button>
                </Link>

                <Button
                  variant={emailSent ? 'outline' : 'primary'}
                  size="sm"
                  onClick={handleSendEmail}
                  isLoading={isSendingEmail}
                  leftIcon={emailSent ? <Check className="w-3.5 h-3.5 text-success" /> : <Send className="w-3.5 h-3.5" />}
                >
                  {emailSent ? 'Send Again to Mailpit' : 'Send Quote Email'}
                </Button>
              </div>
            </DialogFooter>
          </div>
        )}
      </Dialog>

      {formError && (
        <Alert variant="error" className="text-xs">
          {formError}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Configuration */}
        <div className="lg:col-span-8 space-y-6">
          {/* Step 1: Customer Selection */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
                <span>Customer Selection</span>
              </h2>
              <Badge variant="default" className="text-[10px]">
                {leads.length} Leads Available
              </Badge>
            </div>

            <div className="space-y-3">
              {/* Customer Search Bar */}
              <div>
                <SearchInput
                  size="sm"
                  placeholder="Search customer by name, email, or company..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  onClear={() => setCustomerSearch('')}
                  shortcutKey={false}
                  autoShortcut={false}
                />
              </div>

              {/* Customer Dropdown */}
              <SelectField
                label={
                  <span>
                    Prospective Lead / Client
                    {customerSearch.trim() && (
                      <span className="ml-2 font-normal text-neutral-500 text-[11px]">
                        ({filteredLeads.length} matching)
                      </span>
                    )}
                  </span>
                }
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                required
                options={[
                  { value: '', label: '-- Select a Cal.com Sales Lead --' },
                  ...filteredLeads.map((lead) => ({
                    value: lead.id,
                    label: `${lead.name ? `${lead.name} (${lead.email})` : lead.email}${lead.company ? ` — ${lead.company}` : ''}${lead.stage ? ` [${lead.stage}]` : ''}`,
                  })),
                ]}
              />

              {/* Selected Customer Preview Card */}
              {selectedLead && (
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-neutral-800">
                      {selectedLead.name || 'Anonymous Lead'}
                      <span className="text-neutral-500 font-normal ml-2">&lt;{selectedLead.email}&gt;</span>
                    </div>
                    {selectedLead.company && (
                      <div className="text-neutral-600 font-medium text-[11px] mt-0.5">
                        Company: {selectedLead.company}
                      </div>
                    )}
                  </div>
                  <Badge variant="info" className="text-[10px]">
                    {selectedLead.stage || 'Lead'}
                  </Badge>
                </div>
              )}
            </div>
          </Card>

          {/* Step 2: Line Items */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
                <span>Product Line Items</span>
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {selectedItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
                  <div className="flex-1">
                    <label className="text-[10px] font-semibold text-neutral-500 uppercase">Product</label>
                    <select
                      className="w-full text-xs rounded-lg border border-neutral-300 p-1.5 bg-white"
                      value={item.catalogProductId}
                      onChange={(e) => handleItemChange(idx, e.target.value, item.quantity)}
                    >
                      {catalog.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.code} — {cat.name} ({cat.currency} {parseFloat(cat.unitPrice).toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <label className="text-[10px] font-semibold text-neutral-500 uppercase">Qty</label>
                    <Input
                      size="sm"
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, item.catalogProductId, parseInt(e.target.value, 10) || 1)}
                    />
                  </div>

                  <div className="w-28 text-right">
                    <label className="text-[10px] font-semibold text-neutral-500 uppercase">Line Total</label>
                    <div className="text-xs font-mono font-semibold text-neutral-900 pt-1.5">
                      INR {lineDetails[idx]?.lineTotal?.toLocaleString('en-IN') || '0'}
                    </div>
                  </div>

                  {selectedItems.length > 1 && (
                    <div className="pt-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-neutral-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Step 3: Customer Jurisdiction & Discount */}
          <Card className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">3</span>
              <span>Customer Tax Jurisdiction &amp; Discounts</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField
                label="Customer State (GST Rule)"
                value={customerState}
                onChange={(e) => setCustomerState(e.target.value)}
                required
                options={[
                  { value: 'KA', label: 'Karnataka (Intra-state: CGST 9% + SGST 9%)' },
                  { value: 'MH', label: 'Maharashtra (Inter-state: IGST 18%)' },
                  { value: 'DL', label: 'Delhi (Inter-state: IGST 18%)' },
                  { value: 'TN', label: 'Tamil Nadu (Inter-state: IGST 18%)' },
                  { value: 'TG', label: 'Telangana (Inter-state: IGST 18%)' },
                  { value: 'UP', label: 'Uttar Pradesh (Inter-state: IGST 18%)' },
                ]}
              />

              <TextField
                label="City"
                size="sm"
                value={customerCity}
                onChange={(e) => setCustomerCity(e.target.value)}
              />

              <TextField
                label="PIN Code"
                size="sm"
                value={customerPin}
                onChange={(e) => setCustomerPin(e.target.value)}
              />

              <TextField
                label="Customer GSTIN (Optional)"
                size="sm"
                placeholder="e.g. 29AAAAA0000A1Z5"
                value={customerGstin}
                onChange={(e) => setCustomerGstin(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <TextField
                  label="Promo Code (Optional)"
                  size="sm"
                  placeholder="e.g. STREAM9_DEMO"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  leftIcon={<Tag className="w-3.5 h-3.5 text-neutral-500" />}
                />

                {/* Promo Validation Feedback */}
                {matchedPromo ? (
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-success font-medium">
                    <Check className="w-3.5 h-3.5 text-success" />
                    <span>
                      Active: {matchedPromo.code} &mdash;{' '}
                      {matchedPromo.discountType === 'percentage'
                        ? `${matchedPromo.discountValue}% off`
                        : `Flat ₹${parseFloat(matchedPromo.discountValue).toLocaleString('en-IN')} off`}
                      {matchedPromo.description ? ` (${matchedPromo.description})` : ''}
                    </span>
                  </div>
                ) : promoCode.trim() ? (
                  <div className="mt-1 text-[11px] text-warning">
                    Promo code &quot;{promoCode.trim().toUpperCase()}&quot; not found or inactive.
                  </div>
                ) : null}

                {/* Quick-Apply Promo Buttons */}
                {promoCodes.filter((p) => p.isActive).length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-neutral-500 font-medium">Available Promos:</span>
                    {promoCodes
                      .filter((p) => p.isActive)
                      .slice(0, 4)
                      .map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPromoCode(p.code)}
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
                            promoCode.toUpperCase() === p.code
                              ? 'bg-success/15 text-success-foreground border-success/30 font-bold'
                              : 'bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200'
                          }`}
                        >
                          {p.code} (
                          {p.discountType === 'percentage'
                            ? `${p.discountValue}%`
                            : `₹${parseFloat(p.discountValue).toLocaleString('en-IN')}`}
                          )
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div>
                <TextField
                  label="Validity (Days)"
                  size="sm"
                  type="number"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                />
              </div>
            </div>

            <div>
              <TextField
                label="Internal Commercial Notes"
                size="sm"
                placeholder="Optional notes or contractual stipulations..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </Card>
        </div>

        {/* Right Column: Live Tax Summary & Submission */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-6 space-y-4 sticky top-6">
            <h2 className="text-sm font-semibold text-neutral-900 border-b border-neutral-100 pb-3 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              <span>Commercial Financials</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center text-neutral-600">
                <span>Gross Subtotal ({selectedItems.reduce((acc, i) => acc + i.quantity, 0)} items):</span>
                <span className="font-mono font-medium text-neutral-900">
                  INR {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Promo Discount Banner */}
              {matchedPromo && discountAmount > 0 ? (
                <div className="flex justify-between items-center text-emerald-800 bg-emerald-50 px-2.5 py-2 rounded-lg border border-emerald-200">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="success" className="text-[10px] uppercase font-mono font-bold">
                      {matchedPromo.code}
                    </Badge>
                    <span className="text-[11px] font-medium text-emerald-800">
                      ({matchedPromo.discountType === 'percentage'
                        ? `${matchedPromo.discountValue}% off`
                        : `Flat ₹${parseFloat(matchedPromo.discountValue).toLocaleString('en-IN')} off`})
                    </span>
                  </div>
                  <span className="font-mono font-bold text-emerald-700">
                    - INR {discountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ) : null}

              {/* Taxable Base Value */}
              {matchedPromo && discountAmount > 0 && (
                <div className="flex justify-between items-center text-neutral-600 font-medium">
                  <span>Taxable Base Value:</span>
                  <span className="font-mono text-neutral-900">
                    INR {taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}

              {liveTaxResult && (
                <>
                  <div className="flex justify-between items-center text-neutral-600">
                    <span>Tax Classification:</span>
                    <Badge variant={liveTaxResult.taxClassification === 'intra_state' ? 'info' : 'primary'} className="text-[10px]">
                      {liveTaxResult.taxClassification}
                    </Badge>
                  </div>

                  {liveTaxResult.taxClassification === 'intra_state' ? (
                    <>
                      <div className="flex justify-between items-center text-neutral-500 pl-2 text-[11px]">
                        <span>CGST (9%):</span>
                        <span className="font-mono">
                          INR {liveTaxResult.cgstTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-neutral-500 pl-2 text-[11px]">
                        <span>SGST (9%):</span>
                        <span className="font-mono">
                          INR {liveTaxResult.sgstTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-center text-neutral-500 pl-2 text-[11px]">
                      <span>IGST (18%):</span>
                      <span className="font-mono">
                        INR {liveTaxResult.igstTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-neutral-600">
                    <span>Total Statutory GST:</span>
                    <span className="font-mono text-neutral-900">
                      INR {liveTaxResult.taxTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="border-t border-neutral-200 pt-3 flex justify-between items-center font-bold text-neutral-900 text-sm">
                    <span>Total Payable:</span>
                    <span className="font-mono text-primary text-base">
                      INR {(taxableAmount + (liveTaxResult.taxTotal || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-4"
              isLoading={isCreating}
              leftIcon={<FileText className="w-4 h-4" />}
            >
              Generate Commercial Quote
            </Button>
          </Card>
        </div>
      </form>
    </div>
  );
}
