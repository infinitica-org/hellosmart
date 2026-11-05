'use client';

import React, { useState } from 'react';
import {
  PageHeader,
  Card,
  Button,
  Input,
  Badge,
  TextField,
  TextAreaField,
  SelectField,
  SearchInput,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
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
        badge={{ text: 'Catalog', variant: 'info' }}
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
      <Dialog
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        size="md"
      >
        <form onSubmit={handleCreate}>
          <DialogHeader>
            <DialogTitle>Add Catalog Product</DialogTitle>
            <DialogDescription>
              Create an admin-managed commercial product for quoting and subscription billing.
            </DialogDescription>
          </DialogHeader>

          <DialogContent className="space-y-3">
            {formError && (
              <Alert variant="error" className="text-xs">
                {formError}
              </Alert>
            )}

            <TextField
              label="Product Code"
              size="sm"
              placeholder="e.g. BLUEPRINT-DEV-CUSTOM"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />

            <TextField
              label="Product Name"
              size="sm"
              placeholder="e.g. Custom Template Engineering"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                options={[
                  { value: 'plan', label: 'Subscription Plan' },
                  { value: 'custom_template', label: 'Custom Template' },
                  { value: 'addon', label: 'Add-on / Credits' },
                ]}
              />

              <SelectField
                label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                options={[
                  { value: 'INR', label: 'INR (₹)' },
                  { value: 'USD', label: 'USD ($)' },
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Billing Type"
                value={billingType}
                onChange={(e) => setBillingType(e.target.value as any)}
                options={[
                  { value: 'recurring', label: 'Recurring' },
                  { value: 'one_time', label: 'One-time' },
                ]}
              />

              {billingType === 'recurring' ? (
                <SelectField
                  label="Billing Interval"
                  value={billingInterval}
                  onChange={(e) => setBillingInterval(e.target.value as any)}
                  options={[
                    { value: 'month', label: 'Monthly' },
                    { value: 'year', label: 'Yearly' },
                  ]}
                />
              ) : null}
            </div>

            <TextField
              label="Unit Price"
              size="sm"
              type="number"
              step="0.01"
              placeholder="e.g. 25000.00"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              required
            />

            <TextAreaField
              label="Description"
              placeholder="Optional details about this offering..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </DialogContent>

          <DialogFooter>
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
          </DialogFooter>
        </form>
      </Dialog>

      {/* Edit Product Modal */}
      <Dialog
        open={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        size="md"
      >
        {editingItem && (
          <form onSubmit={handleSaveEdit}>
            <DialogHeader>
              <DialogTitle>Edit Product: {editingItem.code}</DialogTitle>
              <DialogDescription>
                Update pricing and description for this catalog offering.
              </DialogDescription>
            </DialogHeader>

            <DialogContent className="space-y-3">
              <TextField
                label="Name"
                size="sm"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />

              <TextField
                label={`Unit Price (${editingItem.currency})`}
                size="sm"
                type="number"
                step="0.01"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                required
              />

              <TextAreaField
                label="Description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={2}
              />
            </DialogContent>

            <DialogFooter>
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
            </DialogFooter>
          </form>
        )}
      </Dialog>

      <Card className="p-6 space-y-5">
        {/* Search & Category Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="w-full sm:w-72">
            <SearchInput
              size="sm"
              placeholder="Search code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClear={() => setSearch('')}
              shortcutKey={false}
              autoShortcut={false}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-3 px-4">Product Code & Name</TableHead>
                  <TableHead className="py-3 px-4">Category</TableHead>
                  <TableHead className="py-3 px-4">Currency</TableHead>
                  <TableHead className="py-3 px-4">Unit Price</TableHead>
                  <TableHead className="py-3 px-4">Status</TableHead>
                  <TableHead className="py-3 px-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-neutral-50/50 transition-colors">
                    <TableCell className="py-3 px-4">
                      <div className="font-mono text-neutral-900 font-semibold">{item.code}</div>
                      <div className="text-neutral-600 text-[11px]">{item.name}</div>
                      {item.description && (
                        <div className="text-neutral-400 text-[10px] truncate max-w-xs">{item.description}</div>
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <Badge variant="default" className="capitalize text-[10px]">
                        {item.category.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3 px-4 font-mono font-medium text-neutral-700">{item.currency}</TableCell>
                    <TableCell className="py-3 px-4 font-mono font-semibold text-neutral-900">
                      {parseFloat(item.unitPrice).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      {item.isActive ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="default">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right space-x-2">
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
