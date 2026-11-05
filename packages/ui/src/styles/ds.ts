/**
 * HelloSmart design-system class fragments.
 * Use these instead of one-off radii, shadows, or palette classes.
 */
export const ds = {
  panel: 'rounded-md border border-card-border bg-white',
  panelMuted: 'rounded-md border border-card-border bg-canvas',
  menu: 'rounded-md border border-card-border bg-white p-1 shadow-lg',
  control:
    'rounded-sm border border-card-border bg-white text-[13px] text-foreground placeholder:text-[#8a95a3] focus:border-nav-accent focus:ring-2 focus:ring-nav-accent/20',
  chrome: 'hs-chrome h-14 text-white',
  navActive: 'bg-[rgba(11,47,92,0.06)] text-nav font-semibold border-l-[3px] border-l-primary',
  navIdle: 'text-[#5b6775] hover:text-nav hover:bg-canvas border-l-[3px] border-l-transparent',
  overlay: 'bg-chrome/50',
  title: 'text-[15px] font-semibold tracking-tight text-foreground',
  body: 'text-[13px] text-[#5b6775] leading-relaxed',
  label: 'text-xs font-semibold text-foreground',
  successChip: 'rounded-sm border border-success-border bg-success-muted text-success-foreground',
  warningChip: 'rounded-sm border border-warning-border bg-warning-muted text-warning-foreground',
  dangerChip: 'rounded-sm border border-danger-border bg-danger-muted text-danger-foreground',
  infoChip: 'rounded-sm border border-info-border bg-info-muted text-info-foreground',
} as const;

export type DsKey = keyof typeof ds;
