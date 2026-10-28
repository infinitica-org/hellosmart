'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, logout, type UserMe } from '@/lib/api-client';

export default function CandidatePortalPage(): React.JSX.Element {
  const router = useRouter();
  const [user, setUser] = useState<UserMe | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    getMe()
      .then((data) => {
        setUser(data);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load candidate session', err);
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

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
          <p className="text-sm font-medium text-slate-600">Loading Candidate Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              HelloSmart<span className="text-indigo-600">.ai</span>
            </span>
            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
              Candidate Workspace
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

      {/* Main Info Card */}
      <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-900/5 space-y-6">
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Account Status: Active
          </span>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome, {user?.name}!
          </h1>
          <p className="text-sm text-slate-600">
            Your candidate account has been successfully activated for{' '}
            <strong className="text-slate-900">{user?.org?.name || 'your assigned organization'}</strong>.
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2 text-xs text-slate-600">
          <div className="font-semibold text-slate-800 text-sm">Next Steps:</div>
          <p>
            When your company administrator assigns an active work simulation assessment, it will appear here with instructions to launch your controlled cloud VM or chat workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
