import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: '#fafbfc',
          alt: '#FAF7F2',
        },
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f8fafc',
          muted: '#f1f5f9',
        },
        background: '#fafbfc',
        foreground: '#0f172a',
        card: {
          DEFAULT: '#ffffff',
          border: 'rgba(226, 232, 240, 0.9)',
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
          cyan: '#38bdf8',
          emerald: '#10b981',
          amber: '#f59e0b',
          rose: '#f43f5e',
          violet: '#8b5cf6',
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
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'pulse-subtle': 'pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-left': 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-bottom': 'slideInBottom 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-top': 'slideInTop 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
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
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInBottom: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideInTop: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

