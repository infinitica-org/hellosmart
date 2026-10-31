'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertDialog, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@hs/ui';
import { Laptop, ShieldAlert } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { IdleWarningModal } from '@/components/session/idle-warning-modal';
import { ActiveSessionsDialog } from '@/components/session/active-sessions-dialog';
import { sessionClient } from '@/lib/session-client';
import { ROUTES, PLACEHOLDERS } from '@/constants';
import type { SidebarItem, SidebarGroup } from '@hs/ui';
import type { NavigationItem } from '@/types/navigation';

export interface PortalShellProps {
  portalTitle: string;
  userRole: string;
  userName: string;
  userEmail?: string | undefined;
  companyName?: string | undefined;
  items?: (SidebarItem | NavigationItem)[];
  groups?: SidebarGroup[];
  onLogout: () => void | Promise<void>;
  children: React.ReactNode;
  footer?: React.ReactNode;
  mainClassName?: string;
  topbarTitle?: React.ReactNode;
}

export function PortalShell({
  portalTitle,
  userRole,
  userName,
  userEmail,
  companyName,
  items,
  groups,
  onLogout,
  children,
  footer,
  mainClassName = 'flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto',
  topbarTitle,
}: PortalShellProps): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showLogoutAll, setShowLogoutAll] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const pathname = usePathname();

  const allNavItems = groups ? groups.flatMap((g) => g.items) : (items || []);
  const activeNavItem = allNavItems.find((item) => {
    if (!item.href || !pathname) return false;
    if (pathname === item.href || pathname === `${item.href}/`) return true;
    if (
      item.href === ROUTES.ADMIN.DASHBOARD ||
      item.href === ROUTES.COMPANY.DASHBOARD ||
      item.href === ROUTES.CANDIDATE.DASHBOARD ||
      item.href === ROUTES.PUBLIC.HOME
    ) {
      return pathname === item.href;
    }
    return pathname.startsWith(`${item.href}/`);
  });

  const pageTitle = topbarTitle ?? activeNavItem?.label ?? 'Dashboard';
  const pageIcon = activeNavItem?.icon;

  const roleLower = userRole?.toLowerCase() || '';
  const searchPlaceholder = roleLower.includes('candidate')
    ? PLACEHOLDERS.SEARCH.GLOBAL_CANDIDATE
    : roleLower.includes('admin')
      ? PLACEHOLDERS.SEARCH.GLOBAL_ADMIN
      : PLACEHOLDERS.SEARCH.GLOBAL_COMPANY;

  const accountHref = roleLower.includes('candidate')
    ? ROUTES.CANDIDATE.PROFILE
    : roleLower.includes('admin')
      ? ROUTES.ADMIN.SETTINGS
      : ROUTES.COMPANY.SETTINGS;

  const preferencesHref = roleLower.includes('candidate')
    ? ROUTES.CANDIDATE.PROFILE
    : roleLower.includes('admin')
      ? ROUTES.ADMIN.SETTINGS
      : ROUTES.COMPANY.SETTINGS;

  const billingHref = roleLower.includes('admin')
    ? ROUTES.ADMIN.SETTINGS
    : roleLower.includes('candidate')
      ? ROUTES.CANDIDATE.DASHBOARD
      : ROUTES.COMPANY.SETTINGS;

  const profileMenuItems = (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Session &amp; Security</DropdownMenuLabel>
      <DropdownMenuItem
        data-testid="active-sessions-menu-item"
        onClick={() => setShowSessions(true)}
        icon={<Laptop className="w-4 h-4" aria-hidden="true" />}
      >
        Active Sessions
      </DropdownMenuItem>
      <DropdownMenuItem
        variant="danger"
        onClick={() => setShowLogoutAll(true)}
        icon={<ShieldAlert className="w-4 h-4" aria-hidden="true" />}
      >
        Sign out of all devices
      </DropdownMenuItem>
    </>
  );

  return (
    <div className="min-h-screen flex bg-white text-neutral-900 font-sans">
      <IdleWarningModal />

      <Sidebar
        variant="dashboard"
        activeStyle="light"
        portalTitle={portalTitle}
        brandTitle={portalTitle}
        portalRole={userRole}
        {...(companyName ? { companyName } : {})}
        items={items}
        groups={groups}
        userName={userName}
        {...(userEmail ? { userEmail } : {})}
        onLogout={() => {
          void onLogout();
        }}
        showMobileBar={false}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-white">
        <Topbar
          variant="dashboard"
          showLogo={false}
          showNotifications={true}
          searchPlaceholder={searchPlaceholder}
          accountHref={accountHref}
          preferencesHref={preferencesHref}
          billingHref={billingHref}
          title={pageTitle}
          titleIcon={pageIcon}
          userName={userName}
          {...(userEmail ? { userEmail } : {})}
          userRole={userRole}
          {...(companyName ? { companyName } : {})}
          onLogout={() => {
            void onLogout();
          }}
          onMenuClick={() => setMobileOpen(true)}
          profileMenuItems={profileMenuItems}
        />

        <main className={mainClassName}>{children}</main>
        {footer}
      </div>

      <ActiveSessionsDialog isOpen={showSessions} onClose={() => setShowSessions(false)} />

      <AlertDialog
        open={showLogoutAll}
        onClose={() => setShowLogoutAll(false)}
        onConfirm={async () => {
          setLoggingOutAll(true);
          await sessionClient.signOutAllDevices();
        }}
        title="Sign out of all devices?"
        description="This will immediately invalidate your active sessions on all browsers and devices. You will need to sign in again."
        confirmLabel={loggingOutAll ? 'Signing out...' : 'Confirm sign-out'}
        cancelLabel="Cancel"
        variant="danger"
        loading={loggingOutAll}
      />
    </div>
  );
}
