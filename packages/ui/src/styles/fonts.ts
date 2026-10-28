/**
 * @hs/ui Font Configurations & Paths
 * Exports standard font-family names and font asset references
 */

export const FONT_GOOGLE_SANS_FLEX = "'Google Sans Flex', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const fontFamilies = {
  sans: FONT_GOOGLE_SANS_FLEX,
  mono: "'JetBrains Mono', 'Fira Code', monospace",
} as const;

export const fontFiles = {
  variable: 'GoogleSansFlex-Variable.ttf',
  regular: 'GoogleSansFlex-Regular.ttf',
  medium: 'GoogleSansFlex-Medium.ttf',
  semiBold: 'GoogleSansFlex-SemiBold.ttf',
  bold: 'GoogleSansFlex-Bold.ttf',
} as const;

