import React from 'react';
import type { Preview } from '@storybook/react';
import './preview.css';

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'light-canvas',
      values: [
        {
          name: 'light-canvas',
          value: '#fafbfc',
        },
        {
          name: 'pure-white',
          value: '#ffffff',
        },
        {
          name: 'dark',
          value: '#090d16',
        },
      ],
    },
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile (375px)',
          styles: { width: '375px', height: '667px' },
        },
        tablet: {
          name: 'Tablet (768px)',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop (1280px)',
          styles: { width: '1280px', height: '800px' },
        },
        wide: {
          name: 'Wide Desktop (1536px)',
          styles: { width: '1536px', height: '900px' },
        },
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="light font-sans text-neutral-900 antialiased p-4 min-h-screen">
        <Story />
      </div>
    ),
  ],
};

export default preview;

