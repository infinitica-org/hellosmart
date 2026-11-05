'use client';

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  Button,
  TextField,
  SelectField,
  useToast,
} from '@hs/ui';
import { CreateOrganizationInput } from '@/types/organization';
import { PLACEHOLDERS, UI_LABELS } from '@/constants';
import { useCreateOrganizationMutation } from '@/store/admin/adminApi';

export interface ProvisionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  'data-testid'?: string;
}

export function ProvisionModal({
  open,
  onClose,
  onSuccess,
  'data-testid': testId = 'provision-modal',
}: ProvisionModalProps) {
  const { toast } = useToast();

  const [formData, setFormData] = useState<{
    name: string;
    slug: string;
    adminEmail: string;
    adminName: string;
    plan: 'trial' | 'pro';
    maxTemplates: number | string;
    maxCandidates: number | string;
    trialDays: number | string;
  }>({
    name: '',
    slug: '',
    adminEmail: '',
    adminName: '',
    plan: 'trial',
    maxTemplates: 5,
    maxCandidates: 25,
    trialDays: 14,
  });

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [createOrganization, { isLoading: isSubmitting }] = useCreateOrganizationMutation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleClose = () => {
    setSlugManuallyEdited(false);
    setErrorMessage(null);
    onClose();
  };

  // Auto-generate slug from company name if not manually edited
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setFormData((prev) => ({
      ...prev,
      name: newName,
      slug: slugManuallyEdited
        ? prev.slug
        : newName
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, ''),
    }));
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugManuallyEdited(true);
    setFormData((prev) => ({
      ...prev,
      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!formData.name.trim()) {
      setErrorMessage('Company Name is required.');
      return;
    }
    if (!formData.slug.trim()) {
      setErrorMessage('Organization Slug is required.');
      return;
    }
    if (!formData.adminEmail.trim() || !formData.adminEmail.includes('@')) {
      setErrorMessage('A valid primary admin email is required.');
      return;
    }
    if (!formData.adminName.trim()) {
      setErrorMessage('Admin Name is required.');
      return;
    }

    try {
      await createOrganization({
        ...formData,
        maxTemplates: Number(formData.maxTemplates) || 5,
        maxCandidates: Number(formData.maxCandidates) || 25,
        trialDays: Number(formData.trialDays) || 14,
      }).unwrap();

      toast({
        title: 'Company Provisioned Successfully',
        description: `"${formData.name}" has been created with ${formData.plan.toUpperCase()} entitlements.`,
        variant: 'success',
      });

      // Reset form
      setFormData({
        name: '',
        slug: '',
        adminEmail: '',
        adminName: '',
        plan: 'trial',
        maxTemplates: 5,
        maxCandidates: 25,
        trialDays: 14,
      });
      setSlugManuallyEdited(false);

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(
        err?.data?.detail ||
          err?.data?.message ||
          err?.message ||
          'An unexpected error occurred during provisioning.',
      );
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} size="lg" data-testid={testId}>
      <form onSubmit={handleSubmit}>
        <DialogHeader>
          <DialogTitle>Provision New Company</DialogTitle>
          <DialogDescription>
            Platform Admins manually provision customer tenants and configure server-side entitlements.
          </DialogDescription>
        </DialogHeader>

        <DialogContent className="space-y-5">
          {errorMessage && (
            <div
              className="p-3.5 rounded-xl border border-danger-border bg-danger-muted text-danger-foreground text-xs flex items-center gap-2"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Row 1: Company Name & Slug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              label="Company Name"
              placeholder={PLACEHOLDERS.INPUTS.COMPANY_NAME}
              value={formData.name}
              onChange={handleNameChange}
              required
              data-testid="provision-name-input"
            />

            <TextField
              label="Organization Slug"
              placeholder={PLACEHOLDERS.INPUTS.COMPANY_SLUG}
              value={formData.slug}
              onChange={handleSlugChange}
              helperText="Unique subpath identifier (a-z, 0-9, hyphens)"
              required
              data-testid="provision-slug-input"
            />
          </div>

          {/* Row 2: Admin Email & Admin Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextField
              label="Admin Email"
              type="email"
              placeholder="admin@acme.com"
              value={formData.adminEmail}
              onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
              helperText="Account creation link sent with forced password reset"
              required
              data-testid="provision-email-input"
            />

            <TextField
              label="Admin Name"
              placeholder="Sarah Jenkins"
              value={formData.adminName}
              onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
              required
              data-testid="provision-admin-name-input"
            />
          </div>

          {/* Row 3: Plan & Quotas */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="sm:col-span-1">
              <SelectField
                label="Plan"
                value={formData.plan}
                onChange={(e) =>
                  setFormData({ ...formData, plan: e.target.value as 'trial' | 'pro' })
                }
                options={[
                  { value: 'trial', label: 'Trial Plan' },
                  { value: 'pro', label: 'Pro Plan' },
                ]}
                data-testid="provision-plan-select"
              />
            </div>

            <div>
              <TextField
                label="Max Templates"
                type="number"
                min="1"
                max="100"
                value={formData.maxTemplates.toString()}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    maxTemplates: val === '' ? '' : parseInt(val, 10) || '',
                  }));
                }}
                onBlur={() => {
                  if (formData.maxTemplates === '' || Number(formData.maxTemplates) < 1) {
                    setFormData((prev) => ({ ...prev, maxTemplates: 1 }));
                  }
                }}
                helperText="Template limit (X)"
                required
                data-testid="provision-max-templates-input"
              />
            </div>

            <div>
              <TextField
                label="Max Candidates"
                type="number"
                min="1"
                max="1000"
                value={formData.maxCandidates.toString()}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    maxCandidates: val === '' ? '' : parseInt(val, 10) || '',
                  }));
                }}
                onBlur={() => {
                  if (formData.maxCandidates === '' || Number(formData.maxCandidates) < 1) {
                    setFormData((prev) => ({ ...prev, maxCandidates: 1 }));
                  }
                }}
                helperText="Candidate quota (Y)"
                required
                data-testid="provision-max-candidates-input"
              />
            </div>

            <div>
              <TextField
                label="Trial Days"
                type="number"
                min="1"
                max="365"
                value={formData.trialDays.toString()}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    trialDays: val === '' ? '' : parseInt(val, 10) || '',
                  }));
                }}
                onBlur={() => {
                  if (formData.trialDays === '' || Number(formData.trialDays) < 1) {
                    setFormData((prev) => ({ ...prev, trialDays: 1 }));
                  }
                }}
                helperText="Trial duration (Z)"
                required
                data-testid="provision-trial-days-input"
              />
            </div>
          </div>
        </DialogContent>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            data-testid="provision-cancel-btn"
          >
            {UI_LABELS.BUTTONS.CANCEL}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            data-testid="provision-submit-btn"
          >
            Provision Company
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  );
}

