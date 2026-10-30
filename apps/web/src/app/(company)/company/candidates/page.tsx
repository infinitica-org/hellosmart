'use client';

import React, { useEffect, useState, useCallback } from 'react';
import type { CandidateDto } from '@hs/contracts';
import {
  PageHeader,
  EmptyState,
  Card,
  Button,
  Badge,
  Input,
  Label,
  Dialog,
  Spinner,
  Alert,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Avatar,
  Plus,
  RefreshCw,
  Mail,
  User as UserIcon,
} from '@hs/ui';
import { listCandidates, inviteCandidate, ApiError } from '@/lib/api-client';

export default function CompanyCandidatesPage(): React.JSX.Element {
  const [candidates, setCandidates] = useState<CandidateDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite modal state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchCandidates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listCandidates();
      setCandidates(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load candidates.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const handleOpenInvite = () => {
    setInviteName('');
    setInviteEmail('');
    setInviteError(null);
    setIsInviteOpen(true);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteError('Please provide both candidate name and a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setInviteError(null);

    try {
      const created = await inviteCandidate({
        name: inviteName.trim(),
        email: inviteEmail.trim().toLowerCase(),
      });
      setCandidates((prev) => [created, ...prev]);
      setSuccessBanner(`Invitation sent successfully to ${created.email}`);
      setIsInviteOpen(false);
      setInviteName('');
      setInviteEmail('');
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'CANDIDATE_ALREADY_EXISTS') {
        setInviteError('A candidate with this email address has already been invited.');
      } else {
        setInviteError(err?.message || 'Failed to send invitation. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge variant="success" dot>
            Active
          </Badge>
        );
      case 'invited':
        return (
          <Badge variant="warning" dot>
            Invited
          </Badge>
        );
      case 'deleted':
        return (
          <Badge variant="default">
            Deleted
          </Badge>
        );
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Candidates"
          description="Invite candidates, manage test assignments, monitor progress, and review scored submissions."
          badge={{ text: 'Candidate Pipeline', variant: 'info' }}
        />
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCandidates}
            disabled={isLoading}
            leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenInvite}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Invite Candidate
          </Button>
        </div>
      </div>

      {successBanner && (
        <Alert
          variant="success"
          title="Invitation Sent"
          onClose={() => setSuccessBanner(null)}
        >
          {successBanner}
        </Alert>
      )}

      {error && (
        <Alert
          variant="error"
          title="Error loading candidates"
        >
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Spinner size="lg" className="text-primary mb-3" />
          <p className="text-sm text-neutral-500 font-medium">Loading candidate pipeline...</p>
        </Card>
      ) : candidates.length === 0 ? (
        <Card className="p-6 sm:p-8">
          <EmptyState
            title="No candidates invited yet"
            description="Add candidate invitations individually or in bulk with single-use expiring links (BR-24)."
            action={{
              label: 'Invite First Candidate',
              onClick: handleOpenInvite,
            }}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden border border-neutral-200">
          <Table
            title="Invited & Active Candidates"
            badge={`${candidates.length} total`}
          >
            <TableHeader>
              <TableRow>
                <TableHead>Candidate</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {candidates.map((candidate) => (
                <TableRow key={candidate.id} className="hover:bg-neutral-50/70">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={candidate.name}
                        size="sm"
                        className="bg-primary/10 text-primary font-semibold text-xs"
                      />
                      <span className="font-medium text-neutral-900">{candidate.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-neutral-600 text-sm font-mono">
                    {candidate.email}
                  </TableCell>
                  <TableCell>{formatStatus(candidate.status)}</TableCell>
                  <TableCell className="text-neutral-500 text-sm">
                    {formatDate(candidate.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Invite Candidate Dialog */}
      <Dialog
        open={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite New Candidate"
        description="Candidate will receive an email containing a secure single-use invitation link with forced password reset on first login (BR-24)."
        size="md"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4 pt-2">
          {inviteError && (
            <Alert
              variant="error"
            >
              {inviteError}
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="candidate-name" required>
              Full Name
            </Label>
            <Input
              id="candidate-name"
              placeholder="e.g. Jane Doe"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              disabled={isSubmitting}
              leftIcon={<UserIcon className="w-4 h-4" />}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="candidate-email" required>
              Email Address
            </Label>
            <Input
              id="candidate-email"
              type="email"
              placeholder="e.g. jane.doe@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={isSubmitting}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />
            <p className="text-xs text-neutral-500">
              An invitation email will be sent automatically. The link expires in 72 hours.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsInviteOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
            >
              Send Invitation
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
