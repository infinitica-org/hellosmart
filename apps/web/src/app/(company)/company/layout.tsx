'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { companyNavigation } from '@/types/navigation';

export default function CompanyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const companyName = 'Company Portal';
  const userName = 'Company Admin';
  const userEmail = 'admin@company.com';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    document.cookie = 'hs_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    document.cookie = 'hs_role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen flex bg-canvas text-neutral-900 font-sans">
      {/* Reusable Sidebar with Dashboard, Assessments, Candidates, Analytics, Settings */}
      <Sidebar
        portalTitle="Company Portal"
        portalRole="company_admin"
        companyName={companyName}
        items={companyNavigation}
        userName={userName}
        userEmail={userEmail}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        {/* Desktop Topbar */}
        <Topbar
          variant="dashboard"
          showLogo={false}
          showProfile={true}
          showNotifications={false}
          userName={userName}
          userEmail={userEmail}
          userRole="Company Admin"
          companyName={companyName}
          onLogout={handleLogout}
          className="hidden md:flex h-16 px-6 sm:px-8 bg-white border-b border-neutral-200"
          
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
