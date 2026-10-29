'use client';

import React, { useState, useRef, useEffect } from 'react';
import { sessionClient } from '@/lib/session-client';
import { ActiveSessionsDialog } from '@/components/session/active-sessions-dialog';

export interface UserMenuProps {
  userName?: string;
  userEmail?: string;
  userRole?: string;
  companyName?: string;
  className?: string;
}

export function UserMenu({
  userName = 'User',
  userEmail,
  userRole,
  companyName,
  className = '',
}: UserMenuProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [showSessionsDialog, setShowSessionsDialog] = useState(false);
  const [showConfirmLogoutAll, setShowConfirmLogoutAll] = useState(false);
  const [isLoggingOutAll, setIsLoggingOutAll] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    await sessionClient.signOut('user-logout');
  };

  const handleConfirmLogoutAll = async () => {
    setIsLoggingOutAll(true);
    await sessionClient.signOutAllDevices();
  };

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  return (
    <div ref={menuContainerRef} className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        data-testid="user-menu-trigger"
        aria-label="User navigation menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2.5 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-semibold text-xs flex items-center justify-center shadow-xs">
          {initials}
        </div>
        <div className="hidden sm:flex flex-col text-left pr-1.5">
          <span className="text-xs font-semibold text-slate-800 leading-tight">{userName}</span>
          {userRole && <span className="text-[10px] text-slate-500 leading-tight capitalize">{userRole}</span>}
        </div>
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-2 shadow-xl shadow-black/10 focus:outline-none animate-in fade-in"
        >
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-900 truncate">{userName}</p>
            {userEmail && <p className="text-xs text-slate-500 truncate">{userEmail}</p>}
            {companyName && (
              <p className="text-[11px] font-medium text-indigo-600 mt-1 truncate">{companyName}</p>
            )}
          </div>

          <div className="py-1">
            <p className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Session & Security
            </p>

            <button
              type="button"
              role="menuitem"
              data-testid="active-sessions-menu-item"
              onClick={() => {
                setIsOpen(false);
                setShowSessionsDialog(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition text-left cursor-pointer"
            >
              <span aria-hidden="true">💻</span>
              Active Sessions
            </button>
          </div>

          <div className="my-1 border-t border-slate-100" />

          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 rounded-lg transition text-left cursor-pointer"
            >
              <span aria-hidden="true">🚪</span>
              Sign out
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                setShowConfirmLogoutAll(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition text-left cursor-pointer"
            >
              <span aria-hidden="true">🔒</span>
              Sign out of all devices
            </button>
          </div>
        </div>
      )}

      {/* Active Sessions Dialog */}
      <ActiveSessionsDialog
        isOpen={showSessionsDialog}
        onClose={() => setShowSessionsDialog(false)}
      />

      {/* Sign Out of All Devices Confirmation Modal */}
      {showConfirmLogoutAll && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="logout-all-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-xl font-bold">
              !
            </div>
            <div className="space-y-1">
              <h3 id="logout-all-title" className="text-base font-bold text-slate-900">
                Sign out of all devices?
              </h3>
              <p className="text-xs text-slate-500">
                This will immediately invalidate your active sessions on all browsers and devices. You will need to sign in again.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmLogoutAll(false)}
                disabled={isLoggingOutAll}
                className="flex-1 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogoutAll}
                disabled={isLoggingOutAll}
                className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                {isLoggingOutAll ? 'Signing out...' : 'Confirm sign-out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
   