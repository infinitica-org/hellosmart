import React from 'react';
import { HeaderNav } from '@/components/navigation';
import { BrandMark } from '@/components/brand-mark';

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#090d16] text-slate-100">
      <div>
        <HeaderNav
          portalName="Assessment Workspace"
          userRole="candidate"
          orgName="Technical Assessment"
        />

        <main className="p-6 sm:p-10 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>

      <footer className="h-16 border-t border-slate-900 px-6 sm:px-12 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <BrandMark size="sm" />
        <span>Controlled Sysbox Isolation &bull; Candidate Workspace</span>
      </footer>
    </div>
  );
}
