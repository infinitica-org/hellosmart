'use client';

import React, { useState } from 'react';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  Textarea,
  EmptyState,
  Alert,
} from '@hs/ui';
import { Plus, Tag, RefreshCw, CheckCircle2, Clock } from 'lucide-react';
import {
  useGetPromoCodesQuery,
  useCreatePromoCodeMutation,
} from '@/store/admin/adminApi';

export default function PromoCodesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [maxUses, setMaxUses] = useState('100');
  const [validUntil, setValidUntil] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: promoCodes = [], isLoading, refetch } = useGetPromoCodesQuery();
  const [createPromo, { isLoading: isCreating }] = useCreatePromoCodeMutation();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const val = parseFloat(discountValue);
    if (!code.trim() || isNaN(val) || val <= 0) {
      setFormError('Please provide a valid promo code and positive discount value.');
      return;
    }

    if (discountType === 'percentage' && val > 100) {
      setFormError('Percentage discount cannot exceed 100%.');
      return;
    }

    try {
      await createPromo({
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        discountType,
        discountValue: val,
        currency: discountType === 'fixed_amount' ? currency : undefined,
        maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
        validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
      }).unwrap();

      setIsCreateOpen(false);
      setCode('');
      setDescription('');
      setDiscountValue('');
      setValidUntil('');
    } catch (err: any) {
      setFormError(err?.data?.detail || err?.message || 'Failed to create promo code.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promotions & Discount Codes"
        description="Concurrency-safe promo codes evaluated at quote generation with atomic SELECT FOR UPDATE redemption."
        badge={{ text: 'SP-008', variant: 'default' }}
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
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              New Promo Code
            </Button>
          </div>
        }
      />

      {/* Create Promo Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 shadow-xl">
            <h2 className="text-sm font-semibold text-neutral-900">Create Promo Code</h2>
            <p className="text-xs text-neutral-500">
              Promo codes apply during commercial quote creation and are locked atomically into financial snapshots.
            </p>

            {formError && (
              <Alert variant="error" className="text-xs">
                {formError}
              </Alert>
            )}

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-700">Promo Code *</label>
                <Input
                  size="sm"
                  placeholder="e.g. EARLYBIRD20"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-700">Discount Type</label>
                  <select
                    className="w-full text-xs rounded-lg border border-neutral-300 p-2 bg-white"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-700">
                    {discountType === 'percentage' ? 'Percentage Value *' : 'Amount Value *'}
                  </label>
                  <Input
                    size="sm"
                    type="number"
                    step="0.01"
                    placeholder={discountType === 'percentage' ? 'e.g. 20' : 'e.g. 5000'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    required
                  />
                </div>
              </div>

              {discountType === 'fixed_amount' && (
                <div>
                  <label className="text-xs font-medium text-neutral-700">Currency</label>
                  <select
                    className="w-full text-xs rounded-lg border border-neutral-300 p-2 bg-white"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-700">Max Redemptions</label>
                  <Input
                    size="sm"
                    type="number"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-700">Expiry Date</label>
                  <Input
                    size="sm"
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-700">Description</label>
                <Textarea
                  placeholder="e.g. 20% discount for early design partners..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isCreating}>
                  Create Code
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Table Card */}
      <Card className="p-6">
        {promoCodes.length === 0 && !isLoading ? (
          <EmptyState
            title="No promo codes configured"
            description="Create promotional discount codes to incentivize prospects during commercial negotiations."
            action={{
              label: 'Create First Promo Code',
              onClick: () => setIsCreateOpen(true),
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-600">
              <thead className="bg-neutral-50 text-neutral-700 uppercase font-semibold border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4">Code & Description</th>
                  <th className="py-3 px-4">Discount</th>
                  <th className="py-3 px-4">Redemptions</th>
                  <th className="py-3 px-4">Validity</th>
                  <th className="py-3 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {promoCodes.map((promo) => {
                  const isExpired = promo.validUntil && new Date(promo.validUntil).getTime() < Date.now();
                  const isExhausted = promo.maxUses && promo.currentUses >= promo.maxUses;
                  const isActive = promo.isActive && !isExpired && !isExhausted;

                  return (
                    <tr key={promo.id} className="hover:bg-neutral-50/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono text-neutral-900 font-semibold flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 text-primary" />
                          <span>{promo.code}</span>
                        </div>
                        {promo.description && (
                          <div className="text-neutral-500 text-[11px]">{promo.description}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="primary" className="font-mono">
                          {promo.discountType === 'percentage'
                            ? `${promo.discountValue}% OFF`
                            : `${promo.currency || 'INR'} ${promo.discountValue} OFF`}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {promo.currentUses} / {promo.maxUses ?? '∞'}
                      </td>
                      <td className="py-3 px-4 text-neutral-500 text-[11px]">
                        {promo.validUntil ? (
                          <span>Until {new Date(promo.validUntil).toLocaleDateString()}</span>
                        ) : (
                          <span>No expiration</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : isExhausted ? (
                          <Badge variant="warning">Exhausted</Badge>
                        ) : (
                          <Badge variant="default">Inactive</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
