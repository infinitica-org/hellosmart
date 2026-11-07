'use client';

import React, { useState, ReactNode } from 'react';
import { BrandMark } from '../brand-mark';
import { Avatar } from '../components/avatar';
import { Input, SearchInput } from '../components/input';
import { Breadcrumbs, BreadcrumbItemData } from './breadcrumbs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './dropdown-menu';
import {
  User,
  Settings,
  CreditCard,
  LogOut,
  Bell,
  Search,
  HelpCircle,
  Menu,
  Clock,
  Home,
} from 'lucide-react';

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
  /** Whether to show the search bar */
  showSearch?: boolean;
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
  /** Custom notification items (defaults to empty list, no dummy data) */
  notifications?: TopbarNotificationItem[];
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
  /** Plan name or status badge text (e.g. "Active plan", "Trial plan", "Platform", "Verified"). */
  planName?: string | null | undefined;
  /** Whether to show the billing link in the user menu. Defaults to false for candidates and true for company/admin */
  showBilling?: boolean | undefined;
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
  planName?: string | null | undefined;
  showBilling?: boolean | undefined;
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
  planName,
  showBilling,
  onAccountClick,
  onPreferencesClick,
  onBillingClick,
  renderLink,
}: TopbarUserProfileDropdownProps) {
  // Resolve link destinations accurately based on role
  const roleLower = userRole?.toLowerCase() || '';
  const isCandidate = roleLower.includes('candidate');
  const isPlatformAdmin = roleLower.includes('platform') || roleLower.includes('super');
  const isCompany = roleLower.includes('company');

  const defaultAccountHref = isCandidate
    ? '/candidate/profile'
    : isPlatformAdmin
      ? '/admin/settings'
      : '/company/settings';

  const defaultPreferencesHref = isCandidate
    ? '/candidate/profile'
    : isPlatformAdmin
      ? '/admin/settings'
      : '/company/settings';

  const defaultBillingHref = isCandidate
    ? undefined
    : isPlatformAdmin
      ? '/admin/settings'
      : '/company/settings';

  const resolvedAccountHref = accountHref ?? defaultAccountHref;
  const resolvedPreferencesHref = preferencesHref ?? defaultPreferencesHref;
  const resolvedBillingHref = billingHref !== undefined ? billingHref : defaultBillingHref;

  // Resolve whether Billing item should be rendered:
  // Candidates NEVER have billing unless explicitly forced.
  // Company & Platform Admin show billing if resolvedBillingHref exists.
  const shouldShowBilling = showBilling !== undefined
    ? showBilling
    : (!isCandidate && Boolean(resolvedBillingHref));

  // Resolve role pill subtitle & plan badge:
  let resolvedPlanLabel: string | null = null;
  let planColorClass = 'text-emerald-600 dark:text-emerald-400 font-medium';

  if (planName !== undefined) {
    resolvedPlanLabel = planName;
    if (planName && /trial/i.test(planName)) {
      planColorClass = 'text-amber-600 dark:text-amber-400 font-medium';
    } else if (planName && (/platform/i.test(planName) || /system/i.test(planName))) {
      planColorClass = 'text-blue-600 dark:text-blue-400 font-medium';
    } else if (planName && /verified/i.test(planName)) {
      planColorClass = 'text-neutral-500 dark:text-neutral-400 font-medium';
    }
  } else if (isCandidate) {
    // Candidates are job seekers taking assessments, not SaaS billing subscribers
    resolvedPlanLabel = 'Verified';
    planColorClass = 'text-neutral-500 dark:text-neutral-400 font-medium';
  } else if (isPlatformAdmin) {
    // Platform super admins manage the whole system, not a tenant subscription
    resolvedPlanLabel = 'Platform';
    planColorClass = 'text-blue-600 dark:text-blue-400 font-medium';
  } else {
    // Company admin on active subscription
    resolvedPlanLabel = 'Active plan';
    planColorClass = 'text-emerald-600 dark:text-emerald-400 font-medium';
  }

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
        className="group flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800/90 hover:bg-neutral-50 dark:hover:bg-neutral-700/60 shadow-xs hover:border-neutral-400 dark:hover:border-neutral-600 transition-all cursor-pointer select-none focus:outline-none shrink-0"
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
            <span>{userRole || (isCandidate ? 'Candidate' : isPlatformAdmin ? 'Super Admin' : 'Company Admin')}</span>
            {resolvedPlanLabel && (
              <>
                <span className="text-neutral-300 dark:text-neutral-600">•</span>
                <span className={planColorClass}>{resolvedPlanLabel}</span>
              </>
            )}
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

        {/* Navigation links matching screenshot: Profile (for candidates) or Account, Preferences, Billing */}
        <div className="py-0.5 space-y-0.5">
          {renderDropdownLink({
            label: isCandidate ? 'Profile' : 'Account',
            icon: <User className="w-4 h-4 shrink-0" />,
            href: resolvedAccountHref,
            onClick: onAccountClick,
            testId: 'account-menu-item',
          })}

          {!isCandidate &&
            renderDropdownLink({
              label: 'Preferences',
              icon: <Settings className="w-4 h-4 shrink-0" />,
              href: resolvedPreferencesHref,
              onClick: onPreferencesClick,
              testId: 'preferences-menu-item',
            })}

          {!isCandidate &&
            shouldShowBilling &&
            resolvedBillingHref &&
            renderDropdownLink({
              label: 'Billing',
              icon: <CreditCard className="w-4 h-4 shrink-0" />,
              href: resolvedBillingHref,
              onClick: onBillingClick,
              testId: 'billing-menu-item',
            })}

          {!isCandidate && profileMenuItems}
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
                <LogOut
                  className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0"
                  aria-hidden="true"
                />
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
  notifications,
  onClick,
}: {
  count?: number | undefined;
  notifications?: TopbarNotificationItem[] | undefined;
  onClick?: (() => void) | undefined;
}) {
  const [items, setItems] = useState<TopbarNotificationItem[]>(notifications ?? []);

  // Sync if external notifications prop changes
  React.useEffect(() => {
    if (notifications !== undefined) {
      setItems(notifications);
    }
  }, [notifications]);

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
          <Bell className="w-[17px] h-[17px]" />
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
      <Search className="w-5 h-5" />
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
      <HelpCircle className="w-5 h-5" />
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
  showSearch = true,
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
  notifications,
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
        className={`sticky top-0 z-40 flex items-center justify-between h-14 px-6 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 ${className}`}
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
        className={`sticky top-0 z-30 flex items-center justify-between h-[70px] px-4 sm:px-6 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 transition-colors ${className}`}
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
              <Menu className="w-5 h-5" aria-hidden="true" />
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
                  <Home className="w-[18px] h-[18px]" />
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
          {/* Topbar Search Input */}
          {showSearch && onSearchChange && (
            <div className="hidden md:flex w-56 lg:w-72">
              <SearchInput
                size="md"
                rounded="md"
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                onClear={() => onSearchChange?.('')}
                placeholder={searchPlaceholder || 'Search candidates, assessments, rubrics...'}
                shortcutKey={false}
                autoShortcut={false}
              />
            </div>
          )}

          {showSearch && onSearchClick && <SearchButton onClick={onSearchClick} />}
          {onHelpClick && <HelpButton onClick={onHelpClick} />}
          {showNotifications && (
            <NotificationBell count={notificationCount} notifications={notifications} onClick={onNotificationsClick} />
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
        className={`sticky top-0 z-40 flex items-center justify-between h-14 px-4 sm:px-6 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 ${className}`}
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
          {showSearch && (
            <div className="w-full max-w-sm">
              <SearchInput
                size="sm"
                rounded="md"
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                onClear={() => onSearchChange?.('')}
                placeholder={searchPlaceholder || 'Search candidates, assessments...'}
                shortcutKey={effectiveShortcut}
                autoShortcut={false}
              />
            </div>
          )}
        </div>

        {/* Right section: Help, notifications, profile, actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onHelpClick && <HelpButton onClick={onHelpClick} />}
          {showNotifications && (
            <NotificationBell count={notificationCount} notifications={notifications} onClick={onNotificationsClick} />
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
        className={`sticky top-0 z-40 flex items-center justify-between h-14 px-4 sm:px-6 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 ${className}`}
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
            <Clock className="w-3.5 h-3.5 text-warning" />
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
      className={`sticky top-0 z-40 flex items-center justify-between h-14 px-4 sm:px-6 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 ${className}`}
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
          <NotificationBell count={notificationCount} notifications={notifications} onClick={onNotificationsClick} />
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
