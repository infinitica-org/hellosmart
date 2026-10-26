'use client';

import React, { useEffect, useState } from 'react';
import { AUTH_COOKIE_NAME, TEAM_ROLES, TeamRole } from '@/lib/auth';
import { LogOut, Shield } from 'lucide-react';

export function UserSessionSidebar() {
  const [currentRole, setCurrentRole] = useState<TeamRole>('sde');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const match = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${AUTH_COOKIE_NAME}=`));
    if (match) {
      const val = match.split('=')[1] as TeamRole;
      if (TEAM_ROLES[val]) {
        setCurrentRole(val);
      }
    }
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/lock', { method: 'POST' });
    } catch {
      // Ignore network errors
    }

    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    window.location.href = '/unlock';
  };

  const activeConf = TEAM_ROLES[currentRole] || TEAM_ROLES.sde;

  return (
    <div className="w-full pt-3 border-t border-fd-border/70">
      <div className="flex items-center justify-between p-2.5 rounded-xl border border-fd-border bg-fd-card/80 backdrop-blur-md shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-fd-muted border border-fd-border shrink-0">
            <Shield className="w-3.5 h-3.5 text-fd-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-fd-muted-foreground leading-none">
              Access Role
            </span>
            <span className="text-xs font-medium text-fd-foreground truncate leading-tight mt-0.5" title={activeConf.name}>
              {activeConf.name}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          title="Log out and end session"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-500/20 hover:border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-mono text-[11px] transition-all cursor-pointer shrink-0 disabled:opacity-50 ml-2"
        >
          <LogOut className="w-3 h-3" />
          <span>{isLoggingOut ? '...' : 'Logout'}</span>
        </button>
      </div>
    </div>
  );
}

// Aliases for compatibility
export const UserSessionNav = UserSessionSidebar;
export const RoleSwitcher = UserSessionSidebar;
