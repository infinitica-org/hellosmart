'use client';

import React, {
  useState,
  useRef,
  useEffect,
  ReactNode,
  forwardRef,
} from 'react';
import { createPortal } from 'react-dom';
import { BrandMark } from '../brand-mark';
import { Avatar } from '../components/avatar';
import { Badge } from '../components/badge';

// ---------------------------------------------------------------------------
// Types & interfaces
// ---------------------------------------------------------------------------

export interface SidebarItem {
  id?: string | undefined;
  label: string;
  href?: string | undefined;
  onClick?: (() => void) | undefined;
  icon?: ReactNode | undefined;
  badge?: string | number | undefined;
  badgeVariant?: ('default' | 'primary' | 'success' | 'warning' | 'danger') | undefined;
  subItems?: SidebarItem[] | undefined;
  target?: string | undefined;
  rel?: string | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
  'data-testid'?: string | undefined;
  data?: Record<string, unknown> | undefined;
  linkProps?: (React.AnchorHTMLAttributes<HTMLAnchorElement> & Record<string, unknown>) | undefined;
}

export interface SidebarGroup {
  id?: string | undefined;
  title?: string | undefined;
  items: SidebarItem[];
}

export type SidebarVariant = 'default' | 'dashboard' | 'rail' | 'carousel';

export interface SidebarRenderLinkProps {
  href: string;
  children: ReactNode;
  className: string;
  onClick?: (() => void) | undefined;
  onMouseEnter?: ((e: React.MouseEvent<HTMLElement>) => void) | undefined;
  onMouseLeave?: (() => void) | undefined;
  item: SidebarItem;
  target?: string | undefined;
  rel?: string | undefined;
  disabled?: boolean | undefined;
  'data-testid'?: string | undefined;
  [key: string]: unknown;
}

export interface SidebarProps {
  variant?: SidebarVariant | undefined;
  brandTitle?: ReactNode | undefined;
  brandLogo?: ReactNode | undefined;
  showLogo?: boolean | undefined;
  showHelp?: boolean | undefined;
  items?: SidebarItem[] | undefined;
  /** Navigation links / items (alias for `items`) */
  navLinks?: SidebarItem[] | undefined;
  groups?: SidebarGroup[] | undefined;
  userName?: string | undefined;
  userEmail?: string | undefined;
  userAvatar?: string | undefined;
  currentPath?: string | undefined;
  activeId?: string | undefined;
  onSelect?: ((item: SidebarItem) => void) | undefined;
  onLogout?: (() => void) | undefined;
  logoSrc?: string | undefined;
  whiteLabel?: boolean | undefined;
  collapsed?: boolean | undefined;
  collapsible?: boolean | undefined;
  onToggleCollapse?: (() => void) | undefined;
  showCollapseButton?: boolean | undefined;
  /** Whether the carousel / rail sidebar is currently maximized (full width) */
  railExpanded?: boolean | undefined;
  /** Callback when the carousel / rail sidebar maximize/minimize is toggled */
  onToggleRailExpand?: ((expanded: boolean) => void) | undefined;
  activeStyle?: ('brand' | 'subtle' | 'dark' | 'light') | undefined;
  hideHeader?: boolean | undefined;
  portalRole?: string | undefined;
  width?: string | undefined;
  className?: string | undefined;
  renderLink?: ((props: SidebarRenderLinkProps) => ReactNode) | undefined;
  portalTitle?: ReactNode | undefined;
  companyName?: string | undefined;
  /** Extra items in the footer user menu (before Sign out) */
  profileMenuItems?: ReactNode | undefined;
  /** Render the fixed mobile hamburger bar. Disable when a Topbar owns the chrome. */
  showMobileBar?: boolean | undefined;
  /** Controlled mobile drawer */
  mobileOpen?: boolean | undefined;
  onMobileOpenChange?: ((open: boolean) => void) | undefined;
  /** Footer action handlers */
  onHelpClick?: (() => void) | undefined;
  onToggleTheme?: (() => void) | undefined;
}

export interface UserProfileDropdownProps {
  userName?: string | undefined;
  userEmail?: string | undefined;
  userAvatar?: string | undefined;
  portalRole?: string | undefined;
  onLogout?: (() => void) | undefined;
  compact?: boolean | undefined;
  variant?: ('card' | 'pill' | 'avatar') | undefined;
  placement?: ('top' | 'bottom' | 'right') | undefined;
  extraMenuItems?: ReactNode | undefined;
}

// ---------------------------------------------------------------------------
// Icons (inline SVG helpers – keeps the file self-contained)
// ---------------------------------------------------------------------------

const ICON_SIZE = 'w-5 h-5 shrink-0';

import {
  Menu as MenuIcon,
  X as CloseIcon,
  MoreVertical as EllipsisVerticalIcon,
  User as UserIcon,
  Settings as SettingsIcon,
  LogOut as LogoutIcon,
  ChevronDown as ChevronDownIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ArrowLeftToLine as ArrowLeftToLineIcon,
  ArrowRightToLine as ArrowRightToLineIcon,
  PanelLeft as PanelLeftIcon,
  PanelLeftOpen,
  PanelLeftClose,
  HelpCircle as HelpCircleIcon,
  ToggleLeft as ToggleSwitchIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Active style helpers
// ---------------------------------------------------------------------------

const activeStyleClasses: Record<NonNullable<SidebarProps['activeStyle']>, { active: string; inactive: string }> = {
  light: {
    active: 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium border border-neutral-200/90 dark:border-neutral-700/60 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] rounded-lg',
    inactive: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/50 border border-transparent rounded-lg font-medium',
  },
  brand: {
    active: 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium border border-neutral-200/90 dark:border-neutral-700/60 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] rounded-lg',
    inactive: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/50 border border-transparent rounded-lg font-medium',
  },
  subtle: {
    active: 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-medium border border-neutral-200/90 dark:border-neutral-700/60 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] rounded-lg',
    inactive: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/50 border border-transparent rounded-lg font-medium',
  },
  dark: {
    active: 'bg-neutral-800 text-white font-medium border border-neutral-700/80 shadow-[0_1px_3px_rgba(0,0,0,0.25)] rounded-lg',
    inactive: 'text-neutral-400 hover:text-white hover:bg-neutral-800/50 border border-transparent rounded-lg font-medium',
  },
};

// ---------------------------------------------------------------------------
// Helper: determine if an item is active
// ---------------------------------------------------------------------------

function isItemActive(item: SidebarItem, currentPath?: string, activeId?: string): boolean {
  if (activeId && item.id) return item.id === activeId;
  if (!currentPath || !item.href) return false;

  // Exact match
  if (currentPath === item.href || currentPath === `${item.href}/`) return true;

  // Root or portal base paths (/admin, /company, /candidate, /dashboard, /) must only match exact
  const isPortalRoot =
    item.href === '/admin' ||
    item.href === '/company' ||
    item.href === '/candidate' ||
    item.href === '/dashboard' ||
    item.href === '/';

  if (isPortalRoot) {
    return false;
  }

  // Sub-routes (e.g. /admin/companies/new matches /admin/companies)
  return currentPath.startsWith(item.href + '/');
}

// ---------------------------------------------------------------------------
// Badge variant mapping
// ---------------------------------------------------------------------------

const badgeVariantMap: Record<NonNullable<SidebarItem['badgeVariant']>, 'default' | 'primary' | 'success' | 'warning' | 'danger'> = {
  default: 'default',
  primary: 'primary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

// ---------------------------------------------------------------------------
// UserProfileDropdown
// ---------------------------------------------------------------------------

export const UserProfileDropdown = forwardRef<HTMLDivElement, UserProfileDropdownProps>(
  (
    {
      userName = 'User',
      userEmail = '',
      userAvatar,
      portalRole,
      onLogout,
      compact = false,
      variant = 'card',
      placement = variant === 'card' ? 'top' : 'bottom',
      extraMenuItems,
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isCandidate = Boolean(portalRole?.toLowerCase().includes('candidate'));

    // Close on outside click or Escape
    useEffect(() => {
      if (!open) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false);
      };

      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [open]);

    // Dropdown placement classes
    const placementClasses: Record<string, string> = {
      top: 'bottom-full mb-2 left-0',
      bottom: 'top-full mt-2 left-0',
      right: 'left-full ml-3 bottom-0',
    };

    const dropdownMenu = (
      <div
        className={`absolute z-50 w-64 rounded-md border border-neutral-200 bg-white p-2 shadow-lg animate-fade-in ${placementClasses[placement] || placementClasses.top}`}
        role="menu"
      >
        {/* Header: name + online badge */}
        <div className="px-3 pt-2 pb-3 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900 truncate">{userName}</span>
            <Badge variant="success" size="sm" dot>Online</Badge>
          </div>
          {userEmail && (
            <p className="text-xs text-neutral-500 mt-0.5 truncate">{userEmail}</p>
          )}
          {portalRole && (
            <p className="text-[10px] text-neutral-400 mt-0.5 uppercase tracking-wider font-medium">{portalRole}</p>
          )}
        </div>

        {/* Menu items */}
        <div className="py-1.5">
          <button
            type="button"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors focus:outline-none"
          >
            <span className="flex items-center gap-2.5">
              <UserIcon />
              {isCandidate ? 'Profile' : 'Profile & Account'}
            </span>
            <kbd className="hidden sm:inline-flex text-[10px] text-neutral-400 font-mono bg-neutral-100 rounded px-1.5 py-0.5">⌘P</kbd>
          </button>

          {!isCandidate && (
            <button
              type="button"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-between gap-2 rounded-sm px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 transition-colors focus:outline-none"
            >
              <span className="flex items-center gap-2.5">
                <SettingsIcon />
                Preferences
              </span>
              <kbd className="hidden sm:inline-flex text-[10px] text-neutral-400 font-mono bg-neutral-100 rounded px-1.5 py-0.5">⌘,</kbd>
            </button>
          )}
          {!isCandidate && extraMenuItems}
        </div>

        {/* Divider */}
        <div className="h-px bg-neutral-200 -mx-2 my-1" role="separator" />

        {/* Sign Out */}
        <div className="py-1">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout?.();
            }}
            className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-xs font-medium text-danger hover:bg-danger-muted transition-colors focus:outline-none"
          >
            <LogoutIcon />
            Sign Out
          </button>
        </div>
      </div>
    );

    // ---- Avatar variant (rail / carousel sidebar bottom) ----
    if (variant === 'avatar') {
      return (
        <div
          ref={(node) => {
            containerRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          className="relative flex items-center justify-center"
        >
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label="User account menu"
            aria-haspopup="menu"
            aria-expanded={open}
            className="relative p-1 rounded-md hover:bg-neutral-100 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-nav-accent/20 group"
          >
            <div className="relative">
              <Avatar
                src={userAvatar}
                name={userName}
                size="md"
                variant="dark"
                shape="circle"
              />
              <span
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-white"
                title="Online"
              />
            </div>
          </button>

          {open && dropdownMenu}
        </div>
      );
    }

    // ---- Card variant (sidebar bottom) ----
    if (variant === 'card') {
      return (
        <div
          ref={(node) => {
            containerRef.current = node;
            if (typeof ref === 'function') ref(node);
            else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }}
          className="relative"
        >
          <div
            className={`w-full flex items-center gap-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-700/60 bg-neutral-50/60 dark:bg-neutral-800/60 px-3 py-2 shadow-2xs hover:bg-neutral-100/60 dark:hover:bg-neutral-700/40 transition-colors ${
              compact ? 'justify-center' : ''
            }`}
          >
            <Avatar
              src={userAvatar}
              name={userName}
              size="sm"
              variant="dark"
              shape="circle"
            />

            {!compact && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 dark:text-white truncate leading-tight">
                  {userName}
                </p>
                {userEmail && (
                  <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate leading-tight mt-0.5">
                    {userEmail}
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-label="User menu"
              aria-haspopup="menu"
              aria-expanded={open}
              className="shrink-0 rounded-lg p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 transition-colors focus:outline-none cursor-pointer"
            >
              <EllipsisVerticalIcon />
            </button>
          </div>

          {open && dropdownMenu}
        </div>
      );
    }

    // ---- Pill variant (topbar / compact) ----
    return (
      <div
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className="relative"
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label="User menu"
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex items-center gap-2.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-300 shadow-xs"
        >
          <Avatar
            src={userAvatar}
            name={userName}
            size="xs"
            variant="dark"
            shape="circle"
          />
          <span className="truncate max-w-[120px]">{userName}</span>
          {userEmail && (
            <span className="hidden lg:inline text-xs text-neutral-400 truncate max-w-[140px]">
              {userEmail}
            </span>
          )}
          <ChevronDownIcon className={`w-3.5 h-3.5 text-neutral-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && dropdownMenu}
      </div>
    );
  }
);
UserProfileDropdown.displayName = 'UserProfileDropdown';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract data-*, aria-*, and custom linkProps from a SidebarItem */
function extractDataAttributes(item: SidebarItem): Record<string, unknown> {
  const dataAttrs: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(item)) {
    if (key.startsWith('data-') || key.startsWith('aria-')) {
      dataAttrs[key] = val;
    }
  }
  return {
    ...dataAttrs,
    ...(item.linkProps || {}),
  };
}

// ---------------------------------------------------------------------------
// SidebarNavItemRow – single nav row (used in expanded & grouped modes)
// ---------------------------------------------------------------------------

interface SidebarNavItemRowProps {
  item: SidebarItem;
  active: boolean;
  styleConfig: { active: string; inactive: string };
  onSelect?: ((item: SidebarItem) => void) | undefined;
  renderLink?: SidebarProps['renderLink'] | undefined;
  depth?: number | undefined;
}

function SidebarNavItemRow({
  item,
  active,
  styleConfig,
  onSelect,
  renderLink,
  depth = 0,
}: SidebarNavItemRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSubItems = item.subItems && item.subItems.length > 0;

  const handleClick = () => {
    if (item.disabled) return;
    if (hasSubItems) {
      setExpanded(!expanded);
    }
    onSelect?.(item);
    item.onClick?.();
  };

  const classes = `group flex items-center justify-between gap-3 w-full h-10 px-3 text-sm font-medium transition-[color,background-color,border-color,box-shadow] duration-150 ease-out cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 ${
    active ? styleConfig.active : styleConfig.inactive
  } ${item.className || ''} ${item.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`;

  const paddingLeft = depth > 0 ? { paddingLeft: `${14 + depth * 16}px` } : undefined;
  const dataAttrs = extractDataAttributes(item);

  const content = (
    <>
      <span className="flex items-center gap-3 min-w-0" style={paddingLeft}>
        {item.icon ? (
          <span className={`w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-150 ${active ? 'text-neutral-900 dark:text-white' : 'text-neutral-500 group-hover:text-neutral-900 dark:text-neutral-400 dark:group-hover:text-white'}`}>
            {item.icon}
          </span>
        ) : (
          <span className={`w-2 h-2 rounded-full shrink-0 ${active ? 'bg-primary' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
        )}
        <span className="truncate text-sm font-medium text-left">{item.label}</span>
      </span>

      <span className="flex items-center gap-1.5 shrink-0">
        {item.badge !== undefined && (
          <span className="ml-auto inline-flex items-center px-2 py-0.5 text-xs font-normal text-neutral-600 dark:text-neutral-300 bg-neutral-100/90 dark:bg-neutral-800 rounded-md border border-neutral-200/50 dark:border-neutral-700/50 shrink-0">
            {item.badge}
          </span>
        )}
        {hasSubItems && (
          <ChevronRightIcon
            className={`w-3.5 h-3.5 text-neutral-400 transition-transform duration-200 ${
 expanded ? 'rotate-90' : ''
 }`}
          />
        )}
      </span>
    </>
  );

  // Use custom link renderer if provided & item has href
  if (renderLink && item.href && !hasSubItems) {
    return (
      <>
        {renderLink({
          href: item.href,
          className: classes,
          onClick: handleClick,
          children: content,
          item,
          target: item.target,
          rel: item.target === '_blank' ? (item.rel || 'noopener noreferrer') : item.rel,
          disabled: item.disabled,
          'data-testid': item['data-testid'],
          ...dataAttrs,
        })}
      </>
    );
  }

  return (
    <>
      {item.href && !hasSubItems ? (
        <a
          href={item.disabled ? undefined : item.href}
          target={item.target}
          rel={item.target === '_blank' ? (item.rel || 'noopener noreferrer') : item.rel}
          className={classes}
          style={paddingLeft}
          aria-current={active ? 'page' : undefined}
          aria-disabled={item.disabled ? true : undefined}
          data-testid={item['data-testid']}
          {...dataAttrs}
          onClick={(e) => {
            if (item.disabled) {
              e.preventDefault();
              return;
            }
            if (onSelect) {
              e.preventDefault();
              handleClick();
            }
          }}
        >
          {content}
        </a>
      ) : (
        <button
          type="button"
          disabled={item.disabled}
          className={classes}
          style={paddingLeft}
          aria-current={active ? 'page' : undefined}
          data-testid={item['data-testid']}
          {...dataAttrs}
          onClick={handleClick}
        >
          {content}
        </button>
      )}

      {/* Sub-items */}
      {hasSubItems && expanded && (
        <div className="mt-0.5 space-y-0.5">
          {item.subItems!.map((sub, idx) => (
            <SidebarNavItemRow
              key={sub.id || idx}
              item={sub}
              active={false}
              styleConfig={styleConfig}
              onSelect={onSelect}
              renderLink={renderLink}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export const Sidebar = forwardRef<HTMLDivElement, SidebarProps>(
  (
    {
      variant = 'default',
      brandTitle,
      brandLogo,
      showLogo = true,
      showHelp,
      items,
      navLinks,
      groups,
      userName,
      userEmail,
      userAvatar,
      currentPath,
      activeId,
      onSelect,
      onLogout,
      logoSrc,
      whiteLabel = false,
      collapsed,
      collapsible = true,
      onToggleCollapse,
      showCollapseButton = true,
      railExpanded,
      onToggleRailExpand,
      activeStyle = 'light',
      hideHeader = false,
      portalRole,
      portalTitle,
      profileMenuItems,
      showMobileBar = true,
      mobileOpen: mobileOpenProp,
      onMobileOpenChange,
      width = 'w-60',
      className = '',
      renderLink,
      onHelpClick,
      onToggleTheme,
    },
    ref
  ) => {
    const [internalMobileOpen, setInternalMobileOpen] = useState(false);
    const mobileOpen = mobileOpenProp ?? internalMobileOpen;
    const setMobileOpen = (open: boolean) => {
      if (mobileOpenProp === undefined) {
        setInternalMobileOpen(open);
      }
      onMobileOpenChange?.(open);
    };
    const resolvedBrandTitle = brandTitle ?? portalTitle;
    const [uncontrolledCollapsed, setUncontrolledCollapsed] = useState(false);
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const [hoveredRailItem, setHoveredRailItem] = useState<{
      label: string;
      badge?: ReactNode | undefined;
      badgeVariant?: SidebarItem['badgeVariant'] | undefined;
      top: number;
      left: number;
    } | null>(null);

    const isRail = variant === 'rail' || variant === 'carousel';
    const isCollapsed = collapsed !== undefined ? collapsed : uncontrolledCollapsed;

    const [internalRailExpanded, setInternalRailExpanded] = useState(false);
    const isRailExpanded = railExpanded !== undefined ? railExpanded : internalRailExpanded;
    const effectiveExpanded = isRail ? isRailExpanded : !isCollapsed;

    const toggleRailExpand = () => {
      const next = !isRailExpanded;
      if (railExpanded === undefined) {
        setInternalRailExpanded(next);
      }
      onToggleRailExpand?.(next);
    };

    const effectiveWidth = effectiveExpanded
      ? (width !== 'w-20' && width !== 'w-[70px]' ? width : 'w-64')
      : 'w-[70px]';

    const handleToggleCollapse = () => {
      if (isRail) {
        toggleRailExpand();
      } else {
        if (collapsed === undefined) {
          setUncontrolledCollapsed((prev) => !prev);
        }
        onToggleCollapse?.();
      }
    };

    const [isDarkMode, setIsDarkMode] = useState(false);
    useEffect(() => {
      if (typeof document !== 'undefined') {
        setIsDarkMode(document.documentElement.classList.contains('dark'));
      }
    }, []);

    const handleToggleDarkMode = () => {
      if (typeof document !== 'undefined') {
        const next = !document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', next);
        setIsDarkMode(next);
        try {
          localStorage.setItem('theme', next ? 'dark' : 'light');
        } catch {
          // ignore
        }
      }
      onToggleTheme?.();
    };


    const styleConfig = activeStyleClasses[activeStyle] || activeStyleClasses.subtle;

    const navItems = navLinks ?? items;

    // Resolve items – flat list or grouped
    const resolvedGroups: SidebarGroup[] = groups
      ? groups
      : navItems
        ? [{ title: 'Overview', items: navItems }]
        : [];

    // Lock body scroll when mobile drawer is open
    useEffect(() => {
      if (mobileOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => {
        document.body.style.overflow = '';
      };
    }, [mobileOpen]);

    // ---- Render standard expanded nav items list ----
    const renderNavItems = () => (
      <nav
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-2 space-y-4 [scrollbar-width:thin] [scrollbar-color:rgba(212,212,216,0.8)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-200 hover:[&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-thumb]:rounded-full"
      >
        {resolvedGroups.map((group, gIdx) => (
          <div key={group.id || gIdx} className="space-y-1">
            {/* Group title */}
            {group.title && (
              <p className="px-3.5 pt-3 pb-1.5 text-sm font-medium text-neutral-400 dark:text-neutral-500 select-none">
                {group.title}
              </p>
            )}

            {group.items.map((item, iIdx) => (
              <SidebarNavItemRow
                key={item.id || iIdx}
                item={item}
                active={isItemActive(item, currentPath, activeId)}
                styleConfig={styleConfig}
                onSelect={(selected) => {
                  onSelect?.(selected);
                  setMobileOpen(false);
                }}
                renderLink={renderLink}
              />
            ))}
          </div>
        ))}
      </nav>
    );

    // ---- Render rail / carousel icon-only nav items ----
    const renderRailNavItems = () => {
      return (
        <nav
          onScroll={() => setHoveredRailItem(null)}
          className={`flex-1 min-h-0 py-3 space-y-3 flex flex-col w-full overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:rgba(212,212,216,0.8)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-200 hover:[&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-thumb]:rounded-full ${
            effectiveExpanded ? 'px-3' : 'px-2 items-center'
          }`}
        >
          {resolvedGroups.map((group, gIdx) => (
            <div key={group.id || gIdx} className="space-y-1.5 flex flex-col items-center w-full">
              {gIdx > 0 && (
                <div className="w-8 h-px bg-neutral-200/80 dark:bg-neutral-700/60 my-1 shrink-0" role="separator" />
              )}
              {group.items.map((item, idx) => {
            const active = isItemActive(item, currentPath, activeId);
            const dataAttrs = extractDataAttributes(item);

            const handleItemClick = () => {
              if (item.disabled) return;
              setHoveredRailItem(null);
              onSelect?.(item);
              item.onClick?.();
              if (mobileOpen) setMobileOpen(false);
            };

            const handleItemMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
              if (effectiveExpanded) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setHoveredRailItem({
                label: item.label,
                badge: item.badge,
                badgeVariant: item.badgeVariant,
                top: rect.top + rect.height / 2,
                left: rect.right + 10,
              });
            };

            const handleItemMouseLeave = () => {
              setHoveredRailItem(null);
            };

            const isDark = activeStyle === 'dark';

            const activeBgClass = isDark
              ? 'bg-neutral-800 text-white border border-neutral-700/80 shadow-[0_1px_3px_rgba(0,0,0,0.25)] rounded-lg font-medium'
              : 'bg-white text-neutral-900 border border-neutral-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] rounded-lg font-medium';

            const inactiveBgClass = 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/50 border border-transparent rounded-lg font-medium';

            const activeIconColor = isDark ? 'text-white' : 'text-neutral-900 dark:text-white';

            const baseClasses = `group relative flex items-center transition-[color,background-color,border-color,box-shadow] duration-150 ease-out cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 select-none ${
              effectiveExpanded
                ? 'w-full h-10 px-3 gap-3 rounded-lg text-sm font-medium'
                : 'w-10 h-10 justify-center mx-auto rounded-lg text-sm font-medium'
            } ${
              active ? activeBgClass : inactiveBgClass
            } ${item.className || ''} ${item.disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`;

            const isTextBadge = typeof item.badge === 'string' && isNaN(Number(item.badge));

            const itemContent = (
              <>
                {/* Active icon: strictly locked to 20x20 dimensions so it never grows or scales */}
                <span
                  className={`flex items-center justify-center shrink-0 transition-colors duration-150 ${
                    active ? activeIconColor : 'text-neutral-400 group-hover:text-neutral-700'
                  }`}
                  style={{ width: 20, height: 20, minWidth: 20, maxWidth: 20, minHeight: 20, maxHeight: 20 }}
                >
                  {item.icon || <span className="w-2.5 h-2.5 rounded-full bg-current" />}
                </span>

                {/* Text label when maximized */}
                {effectiveExpanded && (
                  <span className={`text-sm font-medium truncate flex-1 text-left ${active ? (isDark ? 'text-white' : 'text-neutral-900') : 'text-neutral-600 group-hover:text-neutral-900 dark:text-neutral-400 dark:group-hover:text-white'}`}>
                    {item.label}
                  </span>
                )}

                {/* Badge count / status indicator dot */}
                {item.badge !== undefined && (
                  effectiveExpanded ? (
                    <Badge variant={badgeVariantMap[item.badgeVariant || 'default']} size="sm">
                      {item.badge}
                    </Badge>
                  ) : isTextBadge ? (
                    <span className="absolute top-2 right-2 flex h-2.5 w-2.5 pointer-events-none">
                      {item.badgeVariant === 'success' && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-2.5 w-2.5 ring-2 ring-white shadow-2xs ${
 item.badgeVariant === 'success'
 ? 'bg-success'
                            : item.badgeVariant === 'warning'
                              ? 'bg-warning'
                              : item.badgeVariant === 'danger'
                                ? 'bg-danger'
                                : 'bg-primary'
                        }`}
                      />
                    </span>
                  ) : (
                    <span
                      className={`absolute top-1 right-1 min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white shadow-2xs leading-none pointer-events-none ${
 item.badgeVariant === 'success'
 ? 'bg-success text-white'
                          : item.badgeVariant === 'warning'
                            ? 'bg-warning text-white'
                            : item.badgeVariant === 'danger'
                              ? 'bg-danger text-white'
                              : 'bg-primary text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )
                )}
              </>
            );

            if (renderLink && item.href) {
              return (
                <React.Fragment key={item.id || idx}>
                  {renderLink({
                    href: item.href,
                    className: baseClasses,
                    onClick: handleItemClick,
                    onMouseEnter: handleItemMouseEnter,
                    onMouseLeave: handleItemMouseLeave,
                    children: itemContent,
                    item,
                    target: item.target,
                    rel: item.target === '_blank' ? (item.rel || 'noopener noreferrer') : item.rel,
                    disabled: item.disabled,
                    'data-testid': item['data-testid'],
                    ...dataAttrs,
                  })}
                </React.Fragment>
              );
            }

            if (item.href) {
              return (
                <a
                  key={item.id || idx}
                  href={item.disabled ? undefined : item.href}
                  target={item.target}
                  rel={item.target === '_blank' ? (item.rel || 'noopener noreferrer') : item.rel}
                  aria-current={active ? 'page' : undefined}
                  aria-disabled={item.disabled ? true : undefined}
                  data-testid={item['data-testid']}
                  {...dataAttrs}
                  onMouseEnter={handleItemMouseEnter}
                  onMouseLeave={handleItemMouseLeave}
                  onClick={(e) => {
                    if (item.disabled) {
                      e.preventDefault();
                      return;
                    }
                    if (onSelect) {
                      e.preventDefault();
                      handleItemClick();
                    } else {
                      item.onClick?.();
                      setMobileOpen(false);
                    }
                  }}
                  className={baseClasses}
                  aria-label={item.label}
                >
                  {itemContent}
                </a>
              );
            }

            return (
              <button
                key={item.id || idx}
                type="button"
                disabled={item.disabled}
                aria-current={active ? 'page' : undefined}
                data-testid={item['data-testid']}
                {...dataAttrs}
                onMouseEnter={handleItemMouseEnter}
                onMouseLeave={handleItemMouseLeave}
                onClick={handleItemClick}
                className={baseClasses}
                aria-label={item.label}
              >
                {itemContent}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
};

// ---- Header (logo + brand + optional collapse toggle) ----
    const renderHeader = () => {
      if (hideHeader) return null;

      return (
        <div className="flex items-center justify-between shrink-0 h-[70px] px-4 border-b border-neutral-200 dark:border-neutral-800 gap-2">
          <BrandMark
            showLogo={showLogo}
            logoSrc={logoSrc}
            whiteLabel={whiteLabel}
            showSubtitle={false}
            size="md"
            logoSize="sm"
            customTitle={resolvedBrandTitle}
            className="min-w-0 flex-1 truncate"
          />

          {/* Close button inside mobile drawer */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            title="Close menu"
            className="md:hidden shrink-0 rounded-lg p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors focus:outline-none cursor-pointer"
          >
            <CloseIcon className="w-5 h-5" />
          </button>

          {/* Desktop collapse toggle */}
          {collapsible !== false && showCollapseButton !== false && (
            <button
              type="button"
              onClick={handleToggleCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden md:inline-flex shrink-0 rounded-lg p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors focus:outline-none cursor-pointer"
            >
              {isCollapsed ? (
                <ArrowRightToLineIcon className="w-5 h-5 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200" />
              ) : (
                <ArrowLeftToLineIcon className="w-5 h-5 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200" />
              )}
            </button>
          )}
        </div>
      );
    };

    // ---- Rail / Carousel Header ----
    const renderRailHeader = () => {
      if (hideHeader) return null;

      if (effectiveExpanded) {
        return (
          <div className="flex items-center justify-between shrink-0 h-[70px] px-4 border-b border-neutral-200 dark:border-neutral-800 w-full overflow-hidden gap-2">
            <BrandMark
              showLogo={showLogo}
              logoSrc={logoSrc}
              whiteLabel={whiteLabel}
              showSubtitle={false}
              size="md"
              logoSize="sm"
              fullText={true}
              customTitle={resolvedBrandTitle}
              className="min-w-0 flex-1 truncate"
            />
            {/* Close button inside mobile drawer */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              title="Close menu"
              className="md:hidden shrink-0 rounded-lg p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors focus:outline-none cursor-pointer"
            >
              <CloseIcon className="w-5 h-5" />
            </button>
            {/* Desktop collapse toggle */}
            <button
              type="button"
              onClick={handleToggleCollapse}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="hidden md:inline-flex shrink-0 rounded-lg p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200 transition-colors focus:outline-none cursor-pointer"
            >
              <ArrowLeftToLineIcon className="w-5 h-5 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200" />
            </button>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center shrink-0 h-[70px] w-full border-b border-neutral-200 dark:border-neutral-800">
          <button
            type="button"
            onClick={handleToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="group relative flex items-center justify-center w-11 h-11 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors focus:outline-none cursor-pointer"
          >
            {/* Default state: Show Brand Logo when not hovering */}
            <span className="flex items-center justify-center transition-all duration-200 group-hover:opacity-0 group-hover:scale-75 absolute inset-0 pointer-events-none">
              <BrandMark
                showLogo={showLogo}
                logoSrc={logoSrc}
                whiteLabel={whiteLabel}
                showSubtitle={false}
                size="md"
                logoSize="sm"
                fullText={false}
                customTitle={resolvedBrandTitle}
              />
            </span>

            {/* Hover state: Show Expand Arrow (ArrowRightToLine) when hovering */}
            <span className="flex items-center justify-center transition-all duration-200 opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white absolute inset-0 pointer-events-none">
              <ArrowRightToLineIcon className="w-5 h-5" />
            </span>
          </button>
        </div>
      );
    };

    // ---- Footer (Help, Profile) ----
    const shouldShowHelp =
      showHelp !== undefined ? showHelp : !portalRole?.toLowerCase().includes('candidate');

    const renderFooter = () => {
      return (
        <div className="shrink-0 border-t border-neutral-200 dark:border-neutral-800 p-3 space-y-1 bg-white dark:bg-neutral-900">
          {/* Help */}
          {shouldShowHelp && (
            <button
              type="button"
              onClick={() => {
                if (onHelpClick) onHelpClick();
                else window.open('/docs', '_blank');
              }}
              className="group flex items-center gap-3 w-full h-10 px-3 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/50 rounded-lg transition-colors cursor-pointer select-none"
            >
              <HelpCircleIcon className="w-5 h-5 text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-white shrink-0 transition-colors" />
              <span className="truncate">Help</span>
            </button>
          )}

          {/* Profile */}
          {userName || userEmail ? (
            <UserProfileDropdown
              userName={userName}
              userEmail={userEmail}
              userAvatar={userAvatar}
              portalRole={portalRole}
              onLogout={onLogout}
              extraMenuItems={profileMenuItems}
              variant="card"
              placement="top"
            />
          ) : (
            <div className="flex items-center gap-3 w-full h-10 px-3 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-800/50 rounded-lg transition-colors select-none">
              <UserIcon className="w-5 h-5 text-neutral-500 shrink-0" />
              <span>Profile</span>
            </div>
          )}
        </div>
      );
    };

    // ---- Rail / Carousel Footer ----
    const renderRailFooter = () => {
      if (isRailExpanded) {
        return renderFooter();
      }

      return (
        <div className="shrink-0 p-2 border-t border-neutral-200 dark:border-neutral-800 flex flex-col items-center gap-2 w-full bg-white dark:bg-neutral-900">
          {shouldShowHelp && (
            <button
              type="button"
              onClick={() => {
                if (onHelpClick) onHelpClick();
                else window.open('/docs', '_blank');
              }}
              title="Help"
              aria-label="Help"
              className="w-10 h-10 flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <HelpCircleIcon className="w-5 h-5" />
            </button>
          )}
          {userName || userEmail ? (
            <UserProfileDropdown
              userName={userName}
              userEmail={userEmail}
              userAvatar={userAvatar}
              portalRole={portalRole}
              onLogout={onLogout}
              extraMenuItems={profileMenuItems}
              variant="avatar"
              placement="right"
            />
          ) : null}
        </div>
      );
    };

    // ---- Full sidebar panel (shared between desktop & mobile drawer) ----
    const sidebarPanel = (sidebarWidth: string) => {
      if (!effectiveExpanded) {
        return (
          <aside
            className={`flex flex-col bg-white dark:bg-neutral-900 w-full h-full shrink-0 border-r border-neutral-200 dark:border-neutral-800 ${className} items-center`}
          >
            {renderRailHeader()}
            {renderRailNavItems()}
            {renderRailFooter()}
          </aside>
        );
      }

      return (
        <aside
          className={`flex flex-col bg-white dark:bg-neutral-900 w-full h-full shrink-0 border-r border-neutral-200 dark:border-neutral-800 ${className}`}
        >
          {renderHeader()}
          {renderNavItems()}
          {renderFooter()}
        </aside>
      );
    };

    return (
      <>
        {/* ── Desktop sidebar ── */}
        <div
          ref={ref}
          className={`hidden md:flex flex-col h-screen sticky top-0 transition-[width] duration-200 ease-in-out shrink-0 z-30 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 ${
            effectiveWidth
          }`}
        >
          <div className={`flex flex-col h-full ${effectiveWidth} transition-[width] duration-200 ease-in-out`}>
            {sidebarPanel(effectiveWidth)}
          </div>
        </div>

        {/* ── Mobile hamburger top bar (skipped when Topbar owns chrome) ── */}
        {showMobileBar && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between hs-chrome text-white px-4 py-2.5">
          <BrandMark
            showLogo={showLogo}
            logoSrc={logoSrc}
            whiteLabel={whiteLabel}
            showSubtitle={false}
            size="sm"
            customTitle={resolvedBrandTitle}
          />
          <div className="flex items-center gap-2">
            <UserProfileDropdown
              userName={userName}
              userEmail={userEmail}
              userAvatar={userAvatar}
              portalRole={portalRole}
              onLogout={onLogout}
              extraMenuItems={profileMenuItems}
              variant="avatar"
              placement="bottom"
            />
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className="rounded-sm p-2 text-white/90 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
            >
              <MenuIcon />
            </button>
          </div>
        </div>
        )}

        {/* ── Mobile slide-out drawer ── */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-chrome/50 animate-fade-in"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer */}
            <div className="absolute inset-y-0 left-0 w-72 animate-slide-in-left">
              {sidebarPanel('w-72')}
            </div>
          </div>
        )}

        {/* ── Unclipped floating portal tooltip for rail collapsed items ── */}
        {mounted && hoveredRailItem && typeof document !== 'undefined' && createPortal(
          <div
            style={{
              top: `${hoveredRailItem.top}px`,
              left: `${hoveredRailItem.left}px`,
            }}
            role="tooltip"
            className="fixed -translate-y-1/2 z-[99999] px-3 py-1.5 bg-chrome text-white text-xs font-medium rounded-md whitespace-nowrap shadow-lg flex items-center gap-2 pointer-events-none select-none animate-in fade-in zoom-in-95 duration-100"
          >
            <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-chrome rotate-45" />
            <span>{hoveredRailItem.label}</span>
            {hoveredRailItem.badge !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none shadow-2xs ${
 hoveredRailItem.badgeVariant === 'success'
 ? 'bg-success text-white'
                    : hoveredRailItem.badgeVariant === 'warning'
                      ? 'bg-warning text-white'
                      : hoveredRailItem.badgeVariant === 'danger'
                        ? 'bg-danger text-white'
                        : 'bg-primary text-white'
                }`}
              >
                {hoveredRailItem.badge}
              </span>
            )}
          </div>,
          document.body
        )}
      </>
    );
  }
);
Sidebar.displayName = 'Sidebar';

export default Sidebar;
