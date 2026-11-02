import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#f4f6f8',
          alt: '#eef1f4',
        },
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f7f9fb',
          muted: '#eef1f4',
        },
        chrome: {
          DEFAULT: '#0b1f3a',
          hover: '#0e2a4d',
          muted: '#1a3a5c',
        },
        nav: {
          DEFAULT: '#0b2f5c',
          accent: '#1b6bba',
        },
        background: '#f4f6f8',
        foreground: '#1c2430',
        card: {
          DEFAULT: '#ffffff',
          border: '#d8dee6',
        },
        border: {
          DEFAULT: '#d8dee6',
          subtle: '#eef1f4',
          strong: '#c3ccd6',
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
        },
        accent: {
          orange: '#fe7330',
          cyan: '#1b6bba',
          emerald: '#1aa053',
          amber: '#d97706',
          rose: '#d64545',
          violet: '#0b2f5c',
        },
        success: {
          DEFAULT: '#1aa053',
          muted: '#e8f7ee',
          foreground: '#0f6b38',
          border: '#b7e3c8',
        },
        warning: {
          DEFAULT: '#d97706',
          muted: '#fff7e8',
          foreground: '#9a4d05',
          border: '#f3d7a1',
        },
        danger: {
          DEFAULT: '#d64545',
          muted: '#fdeeee',
          foreground: '#9b1c1c',
          border: '#f3c4c4',
        },
        info: {
          DEFAULT: '#1b6bba',
          muted: '#eaf3fb',
          foreground: '#0b2f5c',
          border: '#b7d4ee',
        },
      },
      borderRadius: {
        'tb-sm': 'var(--tb-radius-sm, 0.5rem)',
        'tb-default': 'var(--tb-radius-default, 0.75rem)',
        'tb-lg': 'var(--tb-radius-lg, 0.875rem)',
        'tb-inner-sm': 'var(--tb-inner-radius-sm, 0.375rem)',
        'tb-inner-default': 'var(--tb-inner-radius-default, 0.625rem)',
        'tb-inner-lg': 'var(--tb-inner-radius-lg, 0.75rem)',
      },
      fontFamily: {
        sans: ['"Google Sans Flex"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'pulse-subtle': 'pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
