import React from 'react';

export default function HomePage(): React.JSX.Element {
  const sampleToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

  return (
    <div className="w-full max-w-lg mx-auto text-center space-y-8 py-12 px-4">
      <div className="space-y-3">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          HelloSmart<span className="text-indigo-600">.ai</span>
        </h1>
        <p className="text-lg font-medium text-slate-600">
          AI-Native Work Simulation for Hiring
        </p>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Evaluate candidates doing real work in controlled cloud workspaces with independent AI reviewer agents.
        </p>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-xl ring-1 ring-slate-900/5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Stream 8 Navigation Hub
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href="/login"
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 transition text-slate-900 font-medium"
          >
            <span className="text-base font-semibold">Sign In</span>
            <span className="text-xs text-slate-500 mt-1">Master portal login for all roles</span>
          </a>

          <a
            href={`/accept-invite?token=${sampleToken}`}
            className="flex flex-col items-center justify-center p-4 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300 transition text-indigo-950 font-medium"
          >
            <span className="text-base font-semibold text-indigo-600">Accept Invitation</span>
            <span className="text-xs text-indigo-500 mt-1">Candidate onboarding &amp; setup</span>
          </a>
        </div>

        <div className="pt-2 text-xs text-slate-500 space-y-1.5 text-left bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div className="font-semibold text-slate-700">Quick Test Credentials:</div>
          <div>
            <span className="font-medium text-slate-600">Company Admin:</span>{' '}
            <code className="bg-white px-1 py-0.5 rounded border text-slate-800">admin@acme.com</code> /{' '}
            <code className="bg-white px-1 py-0.5 rounded border text-slate-800">AdminPassword123!</code>
          </div>
          <div>
            <span className="font-medium text-slate-600">Candidate:</span>{' '}
            <code className="bg-white px-1 py-0.5 rounded border text-slate-800">jane.doe@example.com</code> (or setup via Accept Invitation)
          </div>
          <div className="text-slate-400 text-[11px] pt-0.5">
            Demo Token: <code className="bg-white px-1 py-0.5 rounded text-slate-600 font-mono">0123...cdef</code> (Acme Corporation)
          </div>
        </div>
      </div>
    </div>
  );
}
