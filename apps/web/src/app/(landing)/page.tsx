import React from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/brand-mark';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#090d16] text-slate-100 relative overflow-hidden">
      {/* Background gradients */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-indigo-600/15 blur-[140px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="h-20 border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md px-6 sm:px-12 flex items-center justify-between sticky top-0 z-30">
        <BrandMark size="lg" />

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-semibold text-white px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/25 transition-all"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-4xl mx-auto z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-950/80 border border-indigo-800/60 text-xs font-medium text-indigo-300 mb-6">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          AI-Native Work Simulation for Hiring
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
          Hire by <span className="gradient-text">doing</span>.
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mb-10 leading-relaxed">
          Assess candidates by having them do real work with real AI tools inside secure, controlled cloud workspaces. Independent AI reviewer agents score against your custom rubric.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-base font-semibold text-white shadow-xl shadow-indigo-600/30 transition-all text-center"
          >
            Go to Master Sign-In →
          </Link>
          <a
            href="https://cal.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-base font-semibold text-slate-200 transition-all text-center"
          >
            Book Demo on Cal.com
          </a>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full text-left">
          <div className="glass-card rounded-2xl p-6 border border-slate-800/80">
            <div className="w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-800/60 flex items-center justify-center text-indigo-400 mb-4 font-mono text-sm">
              01
            </div>
            <h3 className="text-base font-semibold text-white mb-1.5">Real Cloud VM Workspaces</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Candidate containers with full Linux terminals, VS Code, and real dev servers via Sysbox isolation.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-slate-800/80">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400 font-mono text-sm">
              02
            </div>
            <h3 className="text-base font-semibold text-white mb-1.5">Governed AI Proxy</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Candidates code with AI assistants while our proxy enforces tokens, caps, RPM limits, and full audit logs.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-slate-800/80">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/60 flex items-center justify-center text-emerald-400 font-mono text-sm">
              03
            </div>
            <h3 className="text-base font-semibold text-white mb-1.5">Evidence-Cited Reviewers</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Multi-dimensional scoring agents evaluate code, thought processes, and decisions with mandatory citations.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <BrandMark size="sm" />
        <span>&copy; {new Date().getFullYear()} HelloSmart.ai. All rights reserved.</span>
      </footer>
    </div>
  );
}
