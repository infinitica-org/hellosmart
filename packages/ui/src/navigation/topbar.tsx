'use client';

import React, { useState, ReactNode } from 'react';
import { BrandMark } from '../brand-mark';
import { Avatar } from '../components/avatar';
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
  /** Optional icon displayed alongside page title */
  titleIcon?: ReactNode;
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
  /** Whether to show breadcrumbs in topbar. Defaults to false */
  showBreadcrumbs?: boolean;
  /** Additional action elements rendered in the right section */
  actions?: ReactNode;
  /** Extra items rendered in the shared profile dropdown (before Sign out) */
  profileMenuItems?: ReactNode;
  /** Test id on the profile trigger (used by portal session tests) */
  profileTriggerTestId?: string;
  /** Mobile hamburger — opens the shared sidebar drawer */
  onMenuClick?: () => void;
  /** Additional CSS classes for the root element */
  className?: string;
  /** Custom link renderer for breadcrumbs and navigation */
  renderLink?: (props: {
    href: string;
    children: ReactNode;
    className: string;
    onClick?: () => void;
  }) => ReactNode;
  /** Navigation destinations for dropdown items */
  accountHref?: string;
  preferencesHref?: string;
  billingHref?: string;
  onAccountClick?: () => void;
  onPreferencesClick?: () => void;
  onBillingClick?: () => void;
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
  return (
    <Avatar
      src={src}
      name={name}
      size={size === 'md' ? 'sm' : 'xs'}
      variant="dark"
      shape="circle"
      status="online"
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: User profile dropdown matching screenshot
// ─────────────────────────────────────────────────────────────────────────────

export interface TopbarUserProfileDropdownProps {
  userName?: string | undefined;
  userEmail?: string | undefined;
  userAvatar?: string | undefined;
  userRole?: string | undefined;
  companyName?: string | undefined;
  onLogout?: (() => void) | undefined;
  profileMenuItems?: ReactNode | undefined;
  profileTriggerTestId?: string | undefined;
  accountHref?: string | undefined;
  preferencesHref?: string | undefined;
  billingHref?: string | undefined;
  onAccountClick?: (() => void) | undefined;
  onPreferencesClick?: (() => void) | undefined;
  onBillingClick?: (() => void) | undefined;
  renderLink?: TopbarProps['renderLink'];
}

export interface TopbarUserProfileDropdownProps {
  userName?: string | undefined;
  userEmail?: string | undefined;
  userAvatar?: string | undefined;
  userRole?: string | undefined;
  companyName?: string | undefined;
  onLogout?: (() => void) | undefined;
  profileMenuItems?: ReactNode | undefined;
  profileTriggerTestId?: string | undefined;
  accountHref?: string | undefined;
  preferencesHref?: string | undefined;
  billingHref?: string | undefined;
  onAccountClick?: (() => void) | undefined;
  onPreferencesClick?: (() => void) | undefined;
  onBillingClick?: (() => void) | undefined;
  renderLink?: TopbarProps['renderLink'];
}

function TopbarUserProfileDropdown({
  userName,
  userEmail,
  userAvatar,
  userRole,
  companyName,
  onLogout,
  profileMenuItems,
  profileTriggerTestId = 'user-menu-trigger',
  accountHref,
  preferencesHref,
  billingHref,
  onAccountClick,
  onPreferencesClick,
  onBillingClick,
  renderLink,
}: TopbarUserProfileDropdownProps) {
  // Resolve link destinations based on role or fallback
  const isCandidate = userRole?.toLowerCase().includes('candidate');
  const isAdmin = userRole?.toLowerCase().includes('admin');

  const defaultAccountHref = isCandidate
    ? '/candidate/profile'
    : isAdmin
      ? '/admin/settings'
      : '/company/settings';

  const defaultPreferencesHref = isCandidate
    ? '/candidate/profile'
    : isAdmin
      ? '/admin/settings'
      : '/company/settings';

  const defaultBillingHref = isAdmin
    ? '/admin/settings'
    : isCandidate
      ? '/candidate'
      : '/company/settings';

  const resolvedAccountHref = accountHref ?? defaultAccountHref;
  const resolvedPreferencesHref = preferencesHref ?? defaultPreferencesHref;
  const resolvedBillingHref = billingHref ?? defaultBillingHref;

  const renderDropdownLink = ({
    label,
    icon,
    href,
    onClick,
    testId,
  }: {
    label: string;
    icon: ReactNode;
    href?: string | undefined;
    onClick?: (() => void) | undefined;
    testId?: string | undefined;
  }) => {
    const itemClasses =
      'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-normal text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100/70 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer select-none text-left';

    const itemContent = (
      <>
        <span className="w-4 h-4 text-neutral-600 dark:text-neutral-400 flex items-center justify-center shrink-0">
          {icon}
        </span>
        <span className="flex-1 truncate">{label}</span>
      </>
    );

    if (renderLink && href) {
      return (
        <React.Fragment key={label}>
          {renderLink({
            href,
            className: itemClasses,
            children: itemContent,
            ...(onClick ? { onClick } : {}),
          })}
        </React.Fragment>
      );
    }

    return (
      <DropdownMenuItem
        key={label}
        href={href}
        data-testid={testId}
        onClick={onClick}
        icon={icon}
      >
        {label}
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu>
      {/* Pill trigger: avatar + name + role subtitle with Active plan */}
      <DropdownMenuTrigger
        data-testid={profileTriggerTestId}
        className="group flex items-center gap-2.5 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-neutral-100/70 dark:hover:bg-neutral-800 transition-colors cursor-pointer select-none focus:outline-none shrink-0"
        aria-label="User account menu"
      >
        <div className="relative shrink-0">
          <UserAvatar src={userAvatar} name={userName} size="md" />
        </div>
        <div className="min-w-0 text-left hidden sm:block">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white leading-tight truncate max-w-[140px]">
            {userName || 'Account'}
          </p>
          <p className="text-[11px] text-neutral-400 leading-tight truncate max-w-[160px] flex items-center gap-1.5 mt-0.5">
            <span>{userRole || 'Admin'}</span>
            <span className="text-neutral-300 dark:text-neutral-600">•</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Active plan</span>
          </p>
        </div>
      </DropdownMenuTrigger>

      {/* Dropdown content matching screenshot: clean rounded-2xl card */}
      <DropdownMenuContent
        align="right"
        className="w-64 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2 shadow-2xl shadow-black/10"
      >
        {/* User info header with avatar matching screenshot */}
        <div className="px-3 py-2.5 flex items-center gap-3">
          <div className="relative shrink-0">
            <UserAvatar src={userAvatar} name={userName} size="md" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-neutral-900 dark:text-white leading-snug truncate">
              {userName || 'User'}
            </p>
            {userEmail ? (
              <p className="text-xs text-neutral-500 dark:text-neutral-400 font-normal truncate mt-0.5">
                {userEmail}
              </p>
            ) : companyName ? (
              <p className="text-xs text-neutral-400 font-normal truncate mt-0.5">{companyName}</p>
            ) : null}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-neutral-100 dark:bg-neutral-800 -mx-1 my-1" role="separator" />

        {/* Navigation links matching screenshot: Account, Preferences, Billing */}
        <div className="py-0.5 space-y-0.5">
          {renderDropdownLink({
            label: 'Account',
            icon: (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            ),
            href: resolvedAccountHref,
            onClick: onAccountClick,
            testId: 'account-menu-item',
          })}

          {renderDropdownLink({
            label: 'Preferences',
            icon: (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            ),
            href: resolvedPreferencesHref,
            onClick: onPreferencesClick,
            testId: 'preferences-menu-item',
          })}

          {renderDropdownLink({
            label: 'Billing',
            icon: (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
            ),
            href: resolvedBillingHref,
            onClick: onBillingClick,
            testId: 'billing-menu-item',
          })}

          {profileMenuItems}
        </div>

        {/* Divider before Log out */}
        {onLogout && <div className="h-px bg-neutral-100 dark:bg-neutral-800 -mx-1 my-1" role="separator" />}

        {/* Log out button matching screenshot: soft red/salmon card, red exit icon, red text */}
        {onLogout && (
          <div className="pt-0.5">
            <DropdownMenuItem
              variant="danger"
              onClick={onLogout}
              data-testid="logout-menu-item"
              icon={
                <svg
                  className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              }
            >
              Log out
            </DropdownMenuItem>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Notification bell button
// ─────────────────────────────────────────────────────────────────────────────

export interface TopbarNotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read?: boolean;
}

function NotificationBell({
  count = 0,
  onClick,
}: {
  count?: number | undefined;
  onClick?: (() => void) | undefined;
}) {
  const [items, setItems] = useState<TopbarNotificationItem[]>([
    {
      id: '1',
      title: 'Assessment submitted',
      description: 'Candidate submitted Senior Full Stack evaluation.',
      time: '12m ago',
      read: false,
    },
    {
      id: '2',
      title: 'AI review completed',
      description: 'All 3 rubric evaluation agents generated scores.',
      time: '45m ago',
      read: false,
    },
    {
      id: '3',
      title: 'Candidate workspace active',
      description: 'Cloud VM session initialized for evaluation.',
      time: '2h ago',
      read: true,
    },
  ]);

  const unreadCount = count > 0 ? count : items.filter((i: TopbarNotificationItem) => !i.read).length;

  const markAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev: TopbarNotificationItem[]) => prev.map((item: TopbarNotificationItem) => ({ ...item, read: true })));
  };

  const markItemAsRead = (id: string) => {
    setItems((prev: TopbarNotificationItem[]) =>
      prev.map((item: TopbarNotificationItem) => (item.id === id ? { ...item, read: true } : item))
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          onClick={onClick}
          className="relative w-9 h-9 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 text-neutral-600 dark:text-neutral-300 flex items-center justify-center transition-colors cursor-pointer focus:outline-none shadow-2xs shrink-0"
          title="Notifications"
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: 17, height: 17 }}
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-neutral-800" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="right"
        className="w-80 sm:w-88 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-0 shadow-2xl shadow-black/10 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary rounded-full">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white font-medium transition-colors cursor-pointer"
            >
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications list */}
        <div className="max-h-72 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60">
          {items.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              No notifications
            </div>
          ) : (
            items.map((item: TopbarNotificationItem) => (
              <div
                key={item.id}
                onClick={() => markItemAsRead(item.id)}
                className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer select-none hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${
                  !item.read ? 'bg-neutral-50/60 dark:bg-neutral-800/30' : ''
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    !item.read ? 'bg-primary' : 'bg-transparent'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-neutral-900 dark:text-white leading-tight">
                    {item.title}
                  </p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">
                    {item.description}
                  </p>
                  <span className="text-[10px] text-neutral-400 mt-1 inline-block">
                    {item.time}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
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
      className="w-8 h-8 rounded-sm flex items-center justify-center text-inherit opacity-80 hover:opacity-100 hover:bg-black/10 transition-colors cursor-pointer"
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
      className="w-8 h-8 rounded-sm flex items-center justify-center text-inherit opacity-80 hover:opacity-100 hover:bg-black/10 transition-colors cursor-pointer"
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
  titleIcon,
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
  showBreadcrumbs = false,
  actions,
  profileMenuItems,
  profileTriggerTestId,
  onMenuClick,
  className = '',
  renderLink,
  accountHref,
  preferencesHref,
  billingHref,
  onAccountClick,
  onPreferencesClick,
  onBillingClick,
}: TopbarProps): React.JSX.Element {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const defaultShortcut = isMac ? '⌘K' : 'Ctrl+K';
  const effectiveShortcut = shortcutKey ?? defaultShortcut;

  // For dashboard and search variants, hide logo by default (it's already in the sidebar)
  const shouldShowLogo = showLogo !== undefined ? showLogo : (variant !== 'dashboard' && variant !== 'search');

  const profile = showProfile ? (
    <TopbarUserProfileDropdown
      userName={userName}
      userEmail={userEmail}
      userAvatar={userAvatar}
      userRole={userRole ?? (variant === 'workspace' ? 'Candidate' : undefined)}
      companyName={companyName}
      onLogout={onLogout}
      profileMenuItems={profileMenuItems}
      profileTriggerTestId={profileTriggerTestId}
      accountHref={accountHref}
      preferencesHref={preferencesHref}
      billingHref={billingHref}
      onAccountClick={onAccountClick}
      onPreferencesClick={onPreferencesClick}
      onBillingClick={onBillingClick}
      renderLink={renderLink}
    />
  ) : null;

  // ── Variant: minimal ────────────────────────────────────────────────────
  if (variant === 'minimal') {
    return (
      <header
        className={`sticky top-0 z-40 flex items-center justify-between h-14 px-6 bg-white border-b border-card-border ${className}`}
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
          {profile}
          {actions}
        </div>
      </header>
    );
  }

  // ── Variant: dashboard ──────────────────────────────────────────────────
  if (variant === 'dashboard') {
    return (
      <header
        className={`sticky top-0 z-30 flex items-center justify-between h-[70px] px-4 sm:px-6 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 transition-colors ${className}`}
        role="banner"
      >
        {/* Left section: breadcrumbs, custom leftContent, or title with home icon */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              aria-label="Open menu"
              className="md:hidden shrink-0 rounded-lg p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors focus:outline-none"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
          )}
          {shouldShowLogo && (
            <BrandMark
              showLogo
              size="sm"
              logoSrc={logoSrc}
              whiteLabel={whiteLabel}
              showSubtitle={false}
              className="mr-2 sm:mr-3 shrink-0"
            />
          )}
          {leftContent ? (
            <div className="min-w-0 truncate">{leftContent}</div>
          ) : (showBreadcrumbs && breadcrumbItems && breadcrumbItems.length > 0) ? (
            <div className="hidden sm:block min-w-0 truncate">
              <Breadcrumbs items={breadcrumbItems} showHomeIcon />
            </div>
          ) : (
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-5 h-5 flex items-center justify-center shrink-0 text-neutral-800 dark:text-neutral-200">
                {titleIcon ? (
                  <span className="w-5   h-5 flex items-center justify-center [&>svg]:w-[18px] [&>svg]:h-[18px] [&>svg]:max-w-[18px] [&>svg]:max-h-[18px]">
                    {titleIcon}
                  </span>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ width: '18px', height: '18px', maxWidth: '18px', maxHeight: '18px' }}
                  >
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                )}
              </span>
              <h1 className="text-sm sm:text-base font-normal text-neutral-900 dark:text-white truncate">
                {title || 'Dashboard'}
              </h1>
            </div>
          )}
        </div>

        {/* Right section: search input, help, notification bell, profile, actions */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Search bar matching screenshot */}
          <div className="relative hidden md:flex items-center bg-neutral-100/80 dark:bg-neutral-800/80 rounded-xl px-3.5 py-2 w-56 lg:w-72 h-10 transition-colors focus-within:bg-white dark:focus-within:bg-neutral-800 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-neutral-300 border border-transparent">
            <svg
              className="w-4 h-4 text-neutral-400 shrink-0 mr-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder={searchPlaceholder || 'Search candidates, assessments, rubrics...'}
              className="bg-transparent border-none text-xs text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 focus:outline-none w-full"
            />
          </div>

          {onSearchClick && <SearchButton onClick={onSearchClick} />}
          {onHelpClick && <HelpButton onClick={onHelpClick} />}
          {showNotifications && (
            <NotificationBell count={notificationCount} onClick={onNotificationsClick} />
          )}
          {profile}
          {actions && <div className="flex items-center gap-1 sm:gap-1.5 ml-1 sm:ml-1.5 shrink-0">{actions}</div>}
        </div>
      </header>
    );
  }

  // ── Variant: search (Dashboard without breadcrumbs) ──────────────────────
  if (variant === 'search') {
    return (
      <header
        className={`sticky top-0 z-40 flex items-center justify-between h-14 px-4 sm:px-6 bg-white border-b border-card-border ${className}`}
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
          {profile}
          {actions && <div className="flex items-center gap-1.5 ml-1.5">{actions}</div>}
        </div>
      </header>
    );
  }

  // ── Variant: workspace (Candidate live test session) ────────────────────
  if (variant === 'workspace') {
    return (
      <header
        className={`sticky top-0 z-40 flex items-center justify-between h-14 px-4 sm:px-6 bg-white border-b border-card-border ${className}`}
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
          <div className="flex items-center gap-1.5 px-3 py-1 bg-warning-muted text-warning-foreground border border-warning-border rounded-full text-xs font-mono font-medium shadow-2xs">
            <svg className="w-3.5 h-3.5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{timerText || '48:15 remaining'}</span>
          </div>

          {/* AI Status badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-neutral-100 text-neutral-700 border border-neutral-200 rounded-full text-[11px] font-medium">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span>AI Assistant: ON</span>
          </div>

          {profile}

          {/* Submit Work CTA */}
          <button
            type="button"
            onClick={onSubmitWork}
            className="text-xs font-semibold px-4 py-2 bg-primary text-white rounded-full hover:bg-primary/90 transition-all shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-nav-accent/20"
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
      className={`sticky top-0 z-40 flex items-center justify-between h-14 px-4 sm:px-6 bg-white border-b border-card-border ${className}`}
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
        {profile}
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
