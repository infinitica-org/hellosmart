'use client';

import React, { useState } from 'react';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  Select,
  Textarea,
  EmptyState,
  Alert,
} from '@hs/ui';
import { Plus, Search, Check, Power, RefreshCw, Edit2, X } from 'lucide-react';
import {
  useGetPricingCatalogQuery,
  useCreatePricingCatalogItemMutation,
  useActivatePricingCatalogItemMutation,
  useDeactivatePricingCatalogItemMutation,
  useUpdatePricingCatalogItemMutation,
} from '@/store/admin/adminApi';

export default function PricingCatalogPage() {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form state for new item
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'plan' | 'custom_template' | 'addon'>('plan');
  const [billingType, setBillingType] = useState<'recurring' | 'one_time'>('recurring');
  const [billingInterval, setBillingInterval] = useState<'month' | 'year'>('month');
  const [currency, setCurrency] = useState('INR');
  const [unitPrice, setUnitPrice] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Form state for editing
  const [editPrice, setEditPrice] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const { data: catalog = [], isLoading, refetch } = useGetPricingCatalogQuery();
  const [createItem, { isLoading: isCreating }] = useCreatePricingCatalogItemMutation();
  const [activateItem] = useActivatePricingCatalogItemMutation();
  const [deactivateItem] = useDeactivatePricingCatalogItemMutation();
  const [updateItem, { isLoading: isUpdating }] = useUpdatePricingCatalogItemMutation();

  const filteredItems = catalog.filter((item) => {
    const matchesSearch =
      !search ||
      item.code.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const price = parseFloat(unitPrice);
    if (!code.trim() || !name.trim() || isNaN(price) || price < 0) {
      setFormError('Please enter a valid code, name, and non-negative unit price.');
      return;
    }

    try {
      const payload: any = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim() || undefined,
        category,
        currency,
        unitPrice: price,
        billingType,
      };

      if (billingType === 'recurring') {
        payload.billingInterval = billingInterval;
      }

      await createItem(payload).unwrap();

      setIsCreateOpen(false);
      setCode('');
      setName('');
      setDescription('');
      setUnitPrice('');
    } catch (err: any) {
      const detail = err?.data?.detail || err?.data?.message || err?.message || 'Failed to create catalog product.';
      const errors = err?.data?.errors;
      if (errors && typeof errors === 'object') {
        const errorDetails = Object.entries(errors)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
          .join('; ');
        setFormError(`${detail} (${errorDetails})`);
      } else {
        setFormError(detail);
      }
    }
  };

  const handleToggleStatus = async (item: any) => {
    try {
      if (item.isActive) {
        await deactivateItem(item.id).unwrap();
      } else {
        await activateItem(item.id).unwrap();
      }
    } catch (err) {
      console.error('Failed to toggle catalog product status', err);
    }
  };

  const handleStartEdit = (item: any) => {
    setEditingItem(item);
    setEditPrice(String(item.unitPrice));
    setEditName(item.name);
    setEditDesc(item.description || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const price = parseFloat(editPrice);
    if (isNaN(price) || price < 0) {
      return;
    }

    try {
      await updateItem({
        id: editingItem.id,
        data: {
          name: editName.trim(),
          description: editDesc.trim() || undefined,
          unitPrice: price,
        },
      }).unwrap();
      setEditingItem(null);
    } catch (err) {
      console.error('Failed to update catalog product', err);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing Catalog"
        description="Database-backed product catalog and pricing rules. Financial prices are frozen into immutable quote lines at issuance."
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
              Add Product
            </Button>
          </div>
        }
      />

      {/* Create Product Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 shadow-xl relative">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-semibold text-neutral-900">Add Catalog Product</h2>
            <p className="text-xs text-neutral-500">
              Create an admin-managed commercial product for quoting and subscription billing.
            </p>

            {formError && (
              <Alert variant="error" className="text-xs">
                {formError}
              </Alert>
            )}

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-700">Product Code *</label>
                <Input
                  size="sm"
                  placeholder="e.g. BLUEPRINT-DEV-CUSTOM"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-700">Product Name *</label>
                <Input
                  size="sm"
                  placeholder="e.g. Custom Template Engineering"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-700">Category</label>
                  <select
                    className="w-full text-xs rounded-lg border border-neutral-300 p-2 bg-white"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                  >
                    <option value="plan">Subscription Plan</option>
                    <option value="custom_template">Custom Template</option>
                    <option value="addon">Add-on / Credits</option>
                  </select>
                </div>
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-neutral-700">Billing Type</label>
                  <select
                    className="w-full text-xs rounded-lg border border-neutral-300 p-2 bg-white"
                    value={billingType}
                    onChange={(e) => setBillingType(e.target.value as any)}
                  >
                    <option value="recurring">Recurring</option>
                    <option value="one_time">One-time</option>
                  </select>
                </div>
                {billingType === 'recurring' && (
                  <div>
                    <label className="text-xs font-medium text-neutral-700">Billing Interval</label>
                    <select
                      className="w-full text-xs rounded-lg border border-neutral-300 p-2 bg-white"
                      value={billingInterval}
                      onChange={(e) => setBillingInterval(e.target.value as any)}
                    >
                      <option value="month">Monthly</option>
                      <option value="year">Yearly</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-700">Unit Price *</label>
                <Input
                  size="sm"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 25000.00"
                  value={unitPrice}
                  onChange={(e) => setUnitPrice(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-700">Description</label>
                <Textarea
                  placeholder="Optional details about this offering..."
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
                  Save Product
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Edit Product Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 space-y-4 shadow-xl relative">
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-semibold text-neutral-900">
              Edit Product: {editingItem.code}
            </h2>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-neutral-700">Name</label>
                <Input
                  size="sm"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-700">Unit Price ({editingItem.currency})</label>
                <Input
                  size="sm"
                  type="number"
                  step="0.01"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-700">Description</label>
                <Textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingItem(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isUpdating}>
                  Update Product
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <Card className="p-6 space-y-5">
        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="w-full sm:w-72">
            <Input
              size="sm"
              placeholder="Search code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={search ? () => setSearch('') : undefined}
              leftIcon={<Search className="w-4 h-4 text-neutral-400" />}
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto bg-neutral-100 p-1 rounded-xl text-xs">
            {['all', 'plan', 'custom_template', 'addon'].map((cat) => (
              <Button
                key={cat}
                type="button"
                variant={categoryFilter === cat ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setCategoryFilter(cat)}
                className="capitalize text-xs px-2.5 py-1"
              >
                {cat.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>

        {/* Catalog Table */}
        {filteredItems.length === 0 && !isLoading ? (
          <EmptyState
            title="No catalog products found"
            description="Add products to make them available for quote building and commercial invoicing."
            action={{
              label: 'Add First Product',
              onClick: () => setIsCreateOpen(true),
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-600">
              <thead className="bg-neutral-50 text-neutral-700 uppercase font-semibold border-b border-neutral-200">
                <tr>
                  <th className="py-3 px-4">Product Code & Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Currency</th>
                  <th className="py-3 px-4">Unit Price</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono text-neutral-900 font-semibold">{item.code}</div>
                      <div className="text-neutral-600 text-[11px]">{item.name}</div>
                      {item.description && (
                        <div className="text-neutral-400 text-[10px] truncate max-w-xs">{item.description}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="default" className="capitalize text-[10px]">
                        {item.category.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-neutral-700">{item.currency}</td>
                    <td className="py-3 px-4 font-mono font-semibold text-neutral-900">
                      {parseFloat(item.unitPrice).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-3 px-4">
                      {item.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="default">Inactive</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(item)}
                        className="text-neutral-600 hover:text-neutral-900 text-xs"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant={item.isActive ? 'outline' : 'primary'}
                        size="sm"
                        className="text-xs"
                        onClick={() => void handleToggleStatus(item)}
                      >
                        {item.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
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
