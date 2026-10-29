'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { UserMenu } from '@/components/layout/user-menu';
import { IdleWarningModal } from '@/components/session/idle-warning-modal';
import { adminNavigation } from '@/types/navigation';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminName = 'Platform Admin';
  const adminEmail = 'platform.admin@hellosmart.ai';

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
      <IdleWarningModal />

      {/* Fixed Left Sidebar with integrated responsive mobile header */}
      <Sidebar
        portalTitle="Admin Console"
        portalRole="platform_admin"
        companyName="HelloSmart Platform"
        items={adminNavigation}
        userName={adminName}
        userEmail={adminEmail}
        onLogout={handleLogout}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        {/* Desktop Topbar: Shown on md: and above alongside persistent sidebar */}
        <Topbar
          variant="dashboard"
          showLogo={false}
          showProfile={false}
          showNotifications={false}
          actions={
            <UserMenu
              userName={adminName}
              userEmail={adminEmail}
              userRole="Super Admin"
              companyName="HelloSmart Platform"
            />
          }
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
