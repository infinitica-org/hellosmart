/**
 * HelloSmart Design System
 * Operations dashboard language (Meraki-inspired chrome + HelloSmart brand).
 */

export const colors = {
  canvas: '#f4f6f8',
  black: '#0b1f3a',
  surface: '#ffffff',
  surfaceSubtle: '#f7f9fb',
  surfaceRaised: '#ffffff',
  surfaceOverlay: '#ffffff',

  white: '#ffffff',
  textPrimary: '#1c2430',
  textSecondary: '#3d4754',
  textMuted: '#5b6775',
  textSubtle: '#8a95a3',

  chrome: {
    DEFAULT: '#0b1f3a',
    hover: '#0e2a4d',
    muted: '#1a3a5c',
    text: '#ffffff',
    textMuted: '#b7c4d4',
  },

  nav: {
    DEFAULT: '#0b2f5c',
    accent: '#1b6bba',
  },

  primary: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#fe7330',
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
    950: '#431407',
    DEFAULT: '#fe7330',
    hover: '#ea580c',
    glow: 'rgba(254, 115, 48, 0.12)',
    muted: 'rgba(254, 115, 48, 0.12)',
  },

  status: {
    success: {
      DEFAULT: '#1aa053',
      bg: '#e8f7ee',
      border: '#b7e3c8',
      text: '#0f6b38',
    },
    warning: {
      DEFAULT: '#d97706',
      bg: '#fff7e8',
      border: '#f3d7a1',
      text: '#9a4d05',
    },
    danger: {
      DEFAULT: '#d64545',
      bg: '#fdeeee',
      border: '#f3c4c4',
      text: '#9b1c1c',
    },
    info: {
      DEFAULT: '#1b6bba',
      bg: '#eaf3fb',
      border: '#b7d4ee',
      text: '#0b2f5c',
    },
  },

  border: {
    subtle: '#eef1f4',
    default: '#d8dee6',
    strong: '#c3ccd6',
    orange: 'rgba(254, 115, 48, 0.28)',
  },

  glass: {
    panelBg: '#ffffff',
    panelBorder: '#d8dee6',
    cardBg: '#ffffff',
    cardBorder: '#d8dee6',
    cardHoverBorder: '#c3ccd6',
    blur: '0px',
  },
} as const;

export const portals = {
  platform_admin: {
    name: 'Platform Administration',
    role: 'platform_admin',
    shortLabel: 'Super Admin',
    accentColor: '#fe7330',
    badgeVariant: 'bg-[#eaf3fb] text-[#0b2f5c] border border-[#b7d4ee]',
    navActiveVariant: 'bg-[rgba(11,47,92,0.06)] text-[#0b2f5c] border-l-[3px] border-l-[#fe7330]',
    pulseColor: '#fe7330',
    portalRoute: '/admin',
  },
  company_admin: {
    name: 'Company Portal',
    role: 'company_admin',
    shortLabel: 'Company Admin',
    accentColor: '#fe7330',
    badgeVariant: 'bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa]',
    navActiveVariant: 'bg-[rgba(11,47,92,0.06)] text-[#0b2f5c] border-l-[3px] border-l-[#fe7330]',
    pulseColor: '#fe7330',
    portalRoute: '/company',
  },
  candidate: {
    name: 'Candidate Workspace',
    role: 'candidate',
    shortLabel: 'Candidate',
    accentColor: '#1aa053',
    badgeVariant: 'bg-[#e8f7ee] text-[#0f6b38] border border-[#b7e3c8]',
    navActiveVariant: 'bg-[rgba(26,160,83,0.08)] text-[#0f6b38] border-l-[3px] border-l-[#1aa053]',
    pulseColor: '#1aa053',
    portalRoute: '/candidate',
  },
} as const;

export const typography = {
  fontFamily: {
    sans: "'Google Sans Flex', Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.8125rem',
    base: '0.875rem',
    lg: '1rem',
    xl: '1.125rem',
    '2xl': '1.375rem',
    '3xl': '1.75rem',
  },
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
  },
} as const;

export const layout = {
  sidebarWidth: '15rem',
  headerHeight: '3.5rem',
  mobileHeaderHeight: '3.5rem',
  maxContainerWidth: '80rem',
  focusedContainerWidth: '64rem',
  borderRadius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.625rem',
    '2xl': '0.75rem',
    full: '9999px',
  },
} as const;

export const theme = {
  colors,
  portals,
  typography,
  layout,
} as const;

export type Theme = typeof theme;
export type PortalRole = keyof typeof portals;
export type PortalThemeConfig = (typeof portals)[PortalRole];

export function getPortalTheme(role?: string): PortalThemeConfig {
  if (role === 'platform_admin') return portals.platform_admin;
  if (role === 'candidate') return portals.candidate;
  return portals.company_admin;
}

export function getRoleBadgeClass(role?: string): string {
  return getPortalTheme(role).badgeVariant;
}
