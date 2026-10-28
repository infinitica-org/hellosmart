/**
 * HelloSmart Design System Theme & Tokens
 * Brand Theme: #fe7330 (Vibrant Brand Orange), Deep Black, and Crisp White
 */

export const colors = {
  // Brand Canvas & Light Foundations
  canvas: '#fafbfc',
  black: '#000000',
  surface: '#ffffff',
  surfaceSubtle: '#f8fafc',
  surfaceRaised: '#ffffff',
  surfaceOverlay: 'rgba(255, 255, 255, 0.95)',

  // Typography (Dark & High-Contrast Text on Light Canvas)
  white: '#ffffff',
  textPrimary: '#0f172a',
  textSecondary: '#334155',
  textMuted: '#64748b',
  textSubtle: '#94a3b8',

  // Primary Brand Color: #fe7330 (HelloSmart Flame Orange)
  primary: {
    50: '#fff7ed',
    100: '#ffedd5',
    200: '#fed7aa',
    300: '#fdba74',
    400: '#fb923c',
    500: '#fe7330', // Core Brand Primary
    600: '#ea580c',
    700: '#c2410c',
    800: '#9a3412',
    900: '#7c2d12',
    950: '#431407',
    DEFAULT: '#fe7330',
    hover: '#ea580c',
    glow: 'rgba(254, 115, 48, 0.25)',
    muted: 'rgba(254, 115, 48, 0.15)',
  },

  // Semantic Status Colors
  status: {
    success: {
      DEFAULT: '#10b981',
      bg: 'rgba(6, 78, 59, 0.4)',
      border: 'rgba(16, 185, 129, 0.3)',
      text: '#34d399',
    },
    warning: {
      DEFAULT: '#f59e0b',
      bg: 'rgba(120, 53, 15, 0.4)',
      border: 'rgba(245, 158, 11, 0.3)',
      text: '#fbbf24',
    },
    danger: {
      DEFAULT: '#f43f5e',
      bg: 'rgba(136, 19, 55, 0.4)',
      border: 'rgba(244, 63, 94, 0.3)',
      text: '#fb7185',
    },
    info: {
      DEFAULT: '#38bdf8',
      bg: 'rgba(14, 116, 144, 0.4)',
      border: 'rgba(56, 189, 248, 0.3)',
      text: '#7dd3fc',
    },
  },

  // Borders & Dividers
  border: {
    subtle: '#1e293b',
    default: '#334155',
    strong: '#475569',
    orange: 'rgba(254, 115, 48, 0.4)',
  },

  // Glassmorphism Values
  glass: {
    panelBg: 'rgba(13, 17, 28, 0.75)',
    panelBorder: 'rgba(51, 65, 85, 0.4)',
    cardBg: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(13, 17, 28, 0.7) 100%)',
    cardBorder: 'rgba(71, 85, 105, 0.3)',
    cardHoverBorder: 'rgba(254, 115, 48, 0.5)',
    blur: '12px',
  },
} as const;

export const portals = {
  platform_admin: {
    name: 'Platform Administration',
    role: 'platform_admin',
    shortLabel: 'Super Admin',
    accentColor: '#fe7330',
    badgeVariant: 'bg-orange-950/80 text-[#fe7330] border-orange-800/60',
    navActiveVariant: 'bg-[#fe7330]/20 text-[#fe7330] border-[#fe7330]/40',
    pulseColor: '#fe7330',
    portalRoute: '/admin',
  },
  company_admin: {
    name: 'Company Portal',
    role: 'company_admin',
    shortLabel: 'Company Admin',
    accentColor: '#fe7330',
    badgeVariant: 'bg-orange-950/80 text-[#fe7330] border-orange-800/60',
    navActiveVariant: 'bg-[#fe7330]/20 text-[#fe7330] border-[#fe7330]/40',
    pulseColor: '#fe7330',
    portalRoute: '/company',
  },
  candidate: {
    name: 'Candidate Workspace',
    role: 'candidate',
    shortLabel: 'Candidate',
    accentColor: '#10b981',
    badgeVariant: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60',
    navActiveVariant: 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40',
    pulseColor: '#34d399',
    portalRoute: '/candidate',
  },
} as const;

export const typography = {
  fontFamily: {
    sans: "'Google Sans Flex', Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', monospace",
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem',// 30px
  },
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
  },
} as const;

export const layout = {
  sidebarWidth: '16rem',         // w-64 (256px)
  headerHeight: '4rem',           // h-16 (64px)
  mobileHeaderHeight: '3.5rem',   // h-14 (56px)
  maxContainerWidth: '80rem',     // max-w-7xl
  focusedContainerWidth: '64rem', // max-w-5xl
  borderRadius: {
    sm: '0.375rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
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

/**
 * Returns the theme configuration for a given portal role
 */
export function getPortalTheme(role?: string): PortalThemeConfig {
  if (role === 'platform_admin') return portals.platform_admin;
  if (role === 'candidate') return portals.candidate;
  return portals.company_admin;
}

/**
 * Returns badge class string for a given portal role
 */
export function getRoleBadgeClass(role?: string): string {
  return getPortalTheme(role).badgeVariant;
}
