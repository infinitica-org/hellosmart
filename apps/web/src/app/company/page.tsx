'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, logout, type UserMe } from '@/lib/api-client';

export default function CompanyPortalPage(): React.JSX.Element {
  const router = useRouter();
  const [user, setUser] = useState<UserMe | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Invite candidate state
  const [candidateName, setCandidateName] = useState<string>('');
  const [candidateEmail, setCandidateEmail] = useState<string>('');
  const [isInviting, setIsInviting] = useState<boolean>(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then((data) => {
        setUser(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load user session', err);
        router.push('/login');
      });
  }, [router]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      // ignore
    } finally {
      router.push('/login');
    }
  };

  const handleInviteCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim() || !candidateEmail.trim()) {
      return;
    }
    setIsInviting(true);
    setInviteSuccess(null);
    setInviteError(null);

    try {
      const res = await fetch('http://localhost:4000/api/v1/candidates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: candidateName.trim(),
          email: candidateEmail.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || 'Failed to invite candidate');
      }

      setInviteSuccess(
        `Invitation sent to ${candidateEmail}! Check Mailpit at http://localhost:8025 to view the activation email.`,
      );
      setCandidateName('');
      setCandidateEmail('');
    } catch (err) {
      setInviteError((err as Error).message || 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
          <p className="text-sm font-medium text-slate-600">Loading Company Portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              HelloSmart<span className="text-indigo-600">.ai</span>
            </span>
            <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
              Company Portal
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Logged in as <strong className="text-slate-800">{user?.name}</strong> ({user?.email})
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm self-start sm:self-auto"
        >
          Sign Out &rarr;
        </button>
      </div>

      {/* Organization Info Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 p-6 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
              Active Organization
            </span>
            <h1 className="text-2xl font-bold">{user?.org?.name || 'Your Company'}</h1>
            <p className="text-sm text-slate-300">
              Manage candidate simulation assessments, invite candidates, and review AI scoring rubrics.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="http://localhost:8025"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 px-4 py-2.5 text-sm font-semibold text-white transition shadow-sm"
            >
              <span>Open Mailpit Inbox</span>
              <span className="text-xs bg-indigo-600/80 px-1.5 py-0.5 rounded">:8025</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Grid: Invite Candidate + Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Invite Candidate */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Invite a Candidate</h2>
            <p className="text-xs text-slate-500">
              Sends an invitation email with a single-use 72-hour activation link (captured locally by Mailpit).
            </p>
          </div>

          {inviteSuccess && (
            <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
              <span className="font-bold">Success!</span> {inviteSuccess}
            </div>
          )}

          {inviteError && (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-800 border border-red-200">
              <span className="font-bold">Error:</span> {inviteError}
            </div>
          )}

          <form onSubmit={handleInviteCandidate} className="space-y-3.5">
            <div>
              <label htmlFor="name" className="block text-xs font-semibold text-slate-700">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="e.g. Jordan Smith"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700">
                Candidate Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                placeholder="e.g. jordan.smith@example.com"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <button
              type="submit"
              disabled={isInviting}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              {isInviting ? 'Sending Invitation...' : 'Send Invitation & Capture in Mailpit'}
            </button>
          </form>
        </div>

        {/* Card 2: Environment & Stream Status */}
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-900/5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">Current Scope &amp; Stream 8</h2>
            <p className="text-xs text-slate-500">
              Authentication, candidate invitation, first-login password setup, and development Mailpit capture.
            </p>
          </div>

          <div className="space-y-2.5 text-xs text-slate-600">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-medium text-slate-700">Authentication</span>
              <span className="text-emerald-700 font-semibold">Active (Session Cookie)</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-medium text-slate-700">Mailpit Local Dispatch</span>
              <span className="text-indigo-700 font-semibold">http://localhost:8025</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-medium text-slate-700">Assessment Workspace</span>
              <span className="text-slate-500 italic">Phase 1 / Stream 9 Scope</span>
            </div>
          </div>

          <div className="pt-2">
            <a
              href="http://localhost:8025"
              target="_blank"
              rel="noreferrer"
              className="block text-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              View All Captured Mails in Mailpit &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
