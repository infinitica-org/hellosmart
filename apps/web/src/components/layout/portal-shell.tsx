'use client';

import React, { useState } from 'react';
import { AlertDialog, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@hs/ui';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { IdleWarningModal } from '@/components/session/idle-warning-modal';
import { ActiveSessionsDialog } from '@/components/session/active-sessions-dialog';
import { sessionClient } from '@/lib/session-client';
import type { SidebarItem } from '@hs/ui';
import type { NavigationItem } from '@/types/navigation';

export interface PortalShellProps {
  portalTitle: string;
  userRole: string;
  userName: string;
  userEmail?: string | undefined;
  companyName?: string | undefined;
  items: (SidebarItem | NavigationItem)[];
  onLogout: () => void | Promise<void>;
  children: React.ReactNode;
  footer?: React.ReactNode;
  mainClassName?: string;
  topbarTitle?: React.ReactNode;
  idleTimeoutSeconds?: number;
}

export function PortalShell({
  portalTitle,
  userRole,
  userName,
  userEmail,
  companyName,
  items,
  onLogout,
  children,
  footer,
  mainClassName = 'flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto',
  topbarTitle,
  idleTimeoutSeconds,
}: PortalShellProps): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showLogoutAll, setShowLogoutAll] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  const profileMenuItems = (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Session &amp; Security</DropdownMenuLabel>
      <DropdownMenuItem
        data-testid="active-sessions-menu-item"
        onClick={() => setShowSessions(true)}
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        }
      >
        Active Sessions
      </DropdownMenuItem>
      <DropdownMenuItem
        variant="danger"
        onClick={() => setShowLogoutAll(true)}
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        }
      >
        Sign out of all devices
      </DropdownMenuItem>
    </>
  );

  return (
    <div className="min-h-screen flex bg-canvas text-neutral-900 font-sans">
      <IdleWarningModal userRole={userRole} idleTimeoutSeconds={idleTimeoutSeconds} />

      <Sidebar
        variant="dashboard"
        activeStyle="light"
        portalTitle={portalTitle}
        brandTitle={portalTitle}
        portalRole={userRole}
        {...(companyName ? { companyName } : {})}
        items={items}
        userName={userName}
        {...(userEmail ? { userEmail } : {})}
        onLogout={() => {
          void onLogout();
        }}
        showMobileBar={false}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          variant="dashboard"
          showLogo={false}
          showNotifications={false}
          title={topbarTitle ?? portalTitle}
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
