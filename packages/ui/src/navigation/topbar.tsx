'use client';

import React, { ReactNode, useState } from 'react';
import { BrandMark } from '../brand-mark';
import { Input } from '../components/input';
import { Breadcrumbs, BreadcrumbItemData } from './breadcrumbs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './dropdown-menu';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type TopbarVariant = 'default' | 'minimal' | 'dashboard' | 'search' | 'workspace';

export interface TopbarProps {
  /** Visual variant: 'default' | 'minimal' | 'dashboard' | 'search' | 'workspace' */
  variant?: TopbarVariant;
  /** Brand title text (used by default/minimal variants) */
  brandTitle?: ReactNode;
  /** Custom brand logo element */
  brandLogo?: ReactNode;
  /** Whether to show the logo. Defaults to false for 'dashboard' and 'search' variants */
  showLogo?: boolean;
  /** Show the notification bell icon */
  showNotifications?: boolean;
  /** Show the user profile pill dropdown */
  showProfile?: boolean;
  /** Custom content for the left section (overrides breadcrumbs/title) */
  leftContent?: ReactNode;
  /** Page title (used when no breadcrumbs or leftContent is provided) */
  title?: ReactNode;
  /** Page subtitle (used with title in default variant) */
  subtitle?: ReactNode;
  /** Search placeholder text (used by search variant) */
  searchPlaceholder?: string;
  /** Value for search input */
  searchValue?: string;
  /** Search input change callback */
  onSearchChange?: (val: string) => void;
  /** Live countdown timer string (used by workspace variant, e.g. "48:15") */
  timerText?: string;
  /** AI policy label (used by workspace variant, e.g. "AI Assistant: ON") */
  aiStatus?: 'on' | 'off' | 'capped';
  /** Callback when candidate submits work in workspace variant */
  onSubmitWork?: () => void;
  /** User's display name */
  userName?: string;
  /** User's email address */
  userEmail?: string;
  /** User's avatar URL */
  userAvatar?: string;
  /** User's role label (e.g. "Admin", "Manager") */
  userRole?: string;
  /** Company/org name */
  companyName?: string;
  /** Callback when the user clicks "Sign out" */
  onLogout?: () => void;
  /** Keyboard shortcut text displayed in search bar (Default: dynamic '⌘K' or 'Ctrl+K') */
  shortcutKey?: string | undefined;
  /** Custom logo image source (passed to BrandMark) */
  logoSrc?: string;
  /** White-label mode: hides "Powered by hellosmart.ai" */
  whiteLabel?: boolean;
  /** Number of unread notifications (shows dot when > 0) */
  notificationCount?: number;
  /** Callback when the notification bell is clicked */
  onNotificationsClick?: () => void;
  /** Callback when the search icon is clicked (shows search button if provided) */
  onSearchClick?: () => void;
  /** Callback when the help icon is clicked */
  onHelpClick?: () => void;
  /** Breadcrumb items for the dashboard variant */
  breadcrumbItems?: BreadcrumbItemData[];
  /** Additional action elements rendered in the right section */
  actions?: ReactNode;
  /** Additional CSS classes for the root element */
  className?: string;
  /** Custom link renderer for breadcrumbs and navigation */
  renderLink?: (props: {
    href: string;
    children: ReactNode;
    className: string;
    onClick?: () => void;
  }) => ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: User avatar component
// ─────────────────────────────────────────────────────────────────────────────

function UserAvatar({
  src,
  name,
  size = 'sm',
}: {
  src?: string | undefined;
  name?: string | undefined;
  size?: ('sm' | 'md') | undefined;
}) {
  const sizeClasses = size === 'md' ? 'w-8 h-8 text-xs' : 'w-7 h-7 text-[11px]';
  const initials = name
    ? name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'User avatar'}
        className={`${sizeClasses} rounded-full object-cover ring-2 ring-white shadow-2xs block`}
      />
    );
  }

  return (
    <span
      className={`${sizeClasses} rounded-full bg-gradient-to-tr from-primary to-orange-400 text-white font-bold flex items-center justify-center ring-2 ring-white shadow-2xs select-none`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: User profile dropdown (pill variant for topbar)
// ─────────────────────────────────────────────────────────────────────────────

function TopbarUserProfileDropdown({
  userName,
  userEmail,
  userAvatar,
  userRole,
  companyName,
  onLogout,
}: {
  userName?: string | undefined;
  userEmail?: string | undefined;
  userAvatar?: string | undefined;
  userRole?: string | undefined;
  companyName?: string | undefined;
  onLogout?: (() => void) | undefined;
}) {
  return (
    <DropdownMenu>
      {/* Pill trigger: avatar with online dot + name + role subtitle + chevron */}
      <DropdownMenuTrigger
        className="group flex items-center gap-2.5 h-10 pl-1.5 pr-3 rounded-full bg-white border border-neutral-200/90 shadow-2xs hover:bg-neutral-50/90 hover:border-neutral-300 transition-all duration-200 cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-primary/20"
        aria-label="User account menu"
      >
        <div className="relative shrink-0">
          <UserAvatar src={userAvatar} name={userName} size="sm" />
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"
            title="Online"
          />
        </div>
        <div className="min-w-0 text-left hidden sm:block">
          <p className="text-xs font-semibold text-neutral-900 leading-tight truncate max-w-[120px]">
            {userName || 'Account'}
          </p>
          {userRole && (
            <p className="text-[10px] text-neutral-400 font-medium leading-tight truncate max-w-[120px]">
              {userRole}
            </p>
          )}
        </div>
        <svg
          className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 transition-transform duration-200 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </DropdownMenuTrigger>

      {/* Dropdown content */}
      <DropdownMenuContent align="right">
        {/* User info header */}
        <div className="px-3 py-2.5">
          <div className="flex items-center gap-3">
            <UserAvatar src={userAvatar} name={userName} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900 truncate">
                {userName || 'User'}
              </p>
              {userEmail && (
                <p className="text-xs text-neutral-500 truncate">{userEmail}</p>
              )}
              {userRole && (
                <span className="inline-block mt-1 text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {userRole}
                </span>
              )}
            </div>
          </div>
          {companyName && (
            <p className="mt-1.5 text-[11px] text-neutral-400 truncate">{companyName}</p>
          )}
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Account</DropdownMenuLabel>

        <DropdownMenuItem
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        >
          Profile
        </DropdownMenuItem>

        <DropdownMenuItem
          icon={
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        >
          Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {onLogout && (
          <DropdownMenuItem
            variant="danger"
            onClick={onLogout}
            icon={
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            }
          >
            Sign out
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Notification bell button
// ─────────────────────────────────────────────────────────────────────────────

function NotificationBell({
  count = 0,
  onClick,
}: {
  count?: number | undefined;
  onClick?: (() => void) | undefined;
}) {
  return (
    <button
      type="button"
      aria-label="Notifications"
      onClick={onClick}
      className="relative w-10 h-10 rounded-full bg-white border border-neutral-200/90 shadow-2xs hover:bg-neutral-50/90 hover:border-neutral-300 text-neutral-600 hover:text-neutral-900 flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
      title="Notifications"
    >
      <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {count > 0 && (
        <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary ring-2 ring-white" />
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Search icon button
// ─────────────────────────────────────────────────────────────────────────────

function SearchButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label="Search"
      onClick={onClick}
      className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
      title="Search"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Help icon button
// ─────────────────────────────────────────────────────────────────────────────

function HelpButton({ onClick }: { onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-label="Help"
      onClick={onClick}
      className="w-9 h-9 rounded-full flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 transition-colors cursor-pointer"
      title="Help"
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Topbar component
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Topbar — a clean, minimal SaaS topbar component with three variants:
 *
 * - `default`: Full topbar with logo, title, and right-side actions.
 * - `minimal`: Simplified topbar with logo and optional actions.
 * - `dashboard`: Designed to sit alongside a sidebar — breadcrumbs on the left,
 *   notifications + user profile pill on the right. No logo by default.
 */
export function Topbar({
  variant = 'default',
  brandTitle,
  brandLogo,
  showLogo,
  showNotifications = true,
  showProfile = true,
  leftContent,
  title,
  subtitle,
  userName,
  userEmail,
  userAvatar,
  userRole,
  companyName,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  timerText,
  aiStatus = 'on',
  onSubmitWork,
  onLogout,
  logoSrc,
  whiteLabel = false,
  notificationCount = 0,
  onNotificationsClick,
  onSearchClick,
  onHelpClick,
  shortcutKey,
  breadcrumbItems,
  actions,
  className = '',
  renderLink,
}: TopbarProps): React.JSX.Element {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const defaultShortcut = isMac ? '⌘K' : 'Ctrl+K';
  const effectiveShortcut = shortcutKey ?? defaultShortcut;

  // For dashboard and search variants, hide logo by default (it's already in the sidebar)
  const shouldShowLogo = showLogo !== undefined ? showLogo : (variant !== 'dashboard' && variant !== 'search');

  // ── Variant: minimal ────────────────────────────────────────────────────
  if (variant === 'minimal') {
    return (
      <header
        className={`sticky top-0 z-40 flex items-center justify-between h-14 px-6 bg-white border-b border-neutral-200 ${className}`}
        role="banner"
      >
        {/* Left: logo */}
        <div className="flex items-center gap-3">
          {shouldShowLogo && (
            <BrandMark
              showLogo
              size="sm"
              logoSrc={logoSrc}
              whiteLabel={whiteLabel}
              showSubtitle={false}
            />
          )}
        </div>

        {/* Right: profile and actions */}
        <div className="flex items-center gap-2">
          {showProfile && (
            <TopbarUserProfileDropdown
              userName={userName}
              userEmail={userEmail}
              userAvatar={userAvatar}
              userRole={userRole}
              companyName={companyName}
              onLogout={onLogout}
            />
          )}
          {actions}
        </div>
      </header>
    );
  }

  // ── Variant: dashboard ──────────────────────────────────────────────────
  if (variant === 'dashboard') {
    return (
      <header
        className={`sticky top-0 z-40 flex items-center justify-between h-14 px-6 bg-white border-b border-neutral-200 ${className}`}
        role="banner"
      >
        {/* Left section: breadcrumbs, custom leftContent, or title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {shouldShowLogo && (
            <BrandMark
              showLogo
              size="sm"
              logoSrc={logoSrc}
              whiteLabel={whiteLabel}
              showSubtitle={false}
              className="mr-3"
            />
          )}
          {leftContent ? (
            leftContent
          ) : (breadcrumbItems && breadcrumbItems.length > 0) ? (
            <Breadcrumbs items={breadcrumbItems} showHomeIcon />
          ) : (
            <Breadcrumbs
              items={[
                { label: 'Dashboard', href: '/dashboard' },
                { label: 'Overview' },
              ]}
              showHomeIcon
            />
          )}
        </div>

        {/* Right section: search, help, notifications, profile, actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onSearchClick && <SearchButton onClick={onSearchClick} />}
          {onHelpClick && <HelpButton onClick={onHelpClick} />}
          {showNotifications && (
            <NotificationBell count={notificationCount} onClick={onNotificationsClick} />
          )}
          {showProfile && (
            <TopbarUserProfileDropdown
              userName={userName}
              userEmail={userEmail}
              userAvatar={userAvatar}
              userRole={userRole}
              companyName={companyName}
              onLogout={onLogout}
            />
          )}
          {actions && <div className="flex items-center gap-1.5 ml-1.5">{actions}</div>}
        </div>
      </header>
    );
  }

  // ── Variant: search (Dashboard without breadcrumbs) ──────────────────────
  if (variant === 'search') {
    return (
      <header
        className={`sticky top-0 z-40 flex items-center justify-between h-14 px-6 bg-white border-b border-neutral-200 ${className}`}
        role="banner"
      >
        {/* Left section: Quick search bar without breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0 flex-1 max-w-md">
          {shouldShowLogo && (
            <BrandMark
              showLogo
              size="sm"
              logoSrc={logoSrc}
              whiteLabel={whiteLabel}
              showSubtitle={false}
              className="mr-3"
            />
          )}
          <div className="w-full max-w-sm">
            <Input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder || 'Search candidates, assessments...'}
              leftIcon={
                <svg
                  className="w-4 h-4 text-neutral-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              }
              rightIcon={
                <kbd className="text-[10px] font-mono text-neutral-400 bg-white border border-neutral-200 rounded px-1.5 py-0.5 shadow-2xs">
                  {effectiveShortcut}
                </kbd>
              }
              className="py-1.5 text-xs bg-neutral-100/80 hover:bg-neutral-100 border-neutral-200/80 rounded-full focus:bg-white placeholder:text-neutral-400"
            />
          </div>
        </div>

        {/* Right section: Help, notifications, profile, actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onHelpClick && <HelpButton onClick={onHelpClick} />}
          {showNotifications && (
            <NotificationBell count={notificationCount} onClick={onNotificationsClick} />
          )}
          {showProfile && (
            <TopbarUserProfileDropdown
              userName={userName}
              userEmail={userEmail}
              userAvatar={userAvatar}
              userRole={userRole}
              companyName={companyName}
              onLogout={onLogout}
            />
          )}
          {actions && <div className="flex items-center gap-1.5 ml-1.5">{actions}</div>}
        </div>
      </header>
    );
  }

  // ── Variant: workspace (Candidate live test session) ────────────────────
  if (variant === 'workspace') {
    return (
      <header
        className={`sticky top-0 z-40 flex items-center justify-between h-14 px-6 bg-white border-b border-neutral-200 ${className}`}
        role="banner"
      >
        {/* Left: Brand logo + divider + assessment title */}
        <div className="flex items-center gap-3 min-w-0">
          <BrandMark
            showLogo
            size="sm"
            logoSrc={logoSrc}
            whiteLabel={whiteLabel}
            showSubtitle={false}
          />
          <div className="h-4 w-px bg-neutral-200 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xs font-semibold text-neutral-900 truncate">
              {title || 'Fullstack React + Node Task'}
            </h1>
            <p className="text-[10px] text-neutral-400 truncate">Live Candidate Workspace</p>
          </div>
        </div>

        {/* Center / Right: Live Timer + AI Status + Profile + Submit Button */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Live countdown timer badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-mono font-medium shadow-2xs">
            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{timerText || '48:15 remaining'}</span>
          </div>

          {/* AI Status badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-full text-[11px] font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI Assistant: ON</span>
          </div>

          {showProfile && (
            <TopbarUserProfileDropdown
              userName={userName}
              userEmail={userEmail}
              userAvatar={userAvatar}
              userRole={userRole || 'Candidate'}
              companyName={companyName}
              onLogout={onLogout}
            />
          )}

          {/* Submit Work CTA */}
          <button
            type="button"
            onClick={onSubmitWork}
            className="text-xs font-semibold px-4 py-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-all shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            Submit Work
          </button>
        </div>
      </header>
    );
  }

  // ── Variant: default ────────────────────────────────────────────────────
  return (
    <header
      className={`sticky top-0 z-40 flex items-center justify-between h-14 px-6 bg-white border-b border-neutral-200 ${className}`}
      role="banner"
    >
      {/* Left section: logo + title/subtitle */}
      <div className="flex items-center gap-3 min-w-0">
        {shouldShowLogo && (
          <BrandMark
            showLogo
            size="sm"
            logoSrc={logoSrc}
            whiteLabel={whiteLabel}
            showSubtitle={false}
          />
        )}
        {leftContent ? (
          leftContent
        ) : (title || subtitle) ? (
          <div className="flex flex-col min-w-0">
            {title && (
              <h1 className="text-sm font-semibold text-neutral-900 truncate">{title}</h1>
            )}
            {subtitle && (
              <p className="text-xs text-neutral-500 truncate">{subtitle}</p>
            )}
          </div>
        ) : null}
      </div>

      {/* Right section: search, help, notifications, profile, actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {onSearchClick && <SearchButton onClick={onSearchClick} />}
        {onHelpClick && <HelpButton onClick={onHelpClick} />}
        {showNotifications && (
          <NotificationBell count={notificationCount} onClick={onNotificationsClick} />
        )}
        {showProfile && (
          <TopbarUserProfileDropdown
            userName={userName}
            userEmail={userEmail}
            userAvatar={userAvatar}
            userRole={userRole}
            companyName={companyName}
            onLogout={onLogout}
          />
        )}
        {actions && <div className="flex items-center gap-1.5 ml-1.5">{actions}</div>}
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Aliases
// ─────────────────────────────────────────────────────────────────────────────

/** Alias for Topbar — use whichever name suits your project */
export const Navbar = Topbar;
/** Alias for TopbarProps */
export type NavbarProps = TopbarProps;
