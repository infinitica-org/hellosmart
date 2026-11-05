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
          value: '#f4f6f8',
        },
        {
          name: 'pure-white',
          value: '#ffffff',
        },
        {
          name: 'midnight-chrome',
          value: '#0b1f3a',
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
      <div className="light font-sans text-foreground antialiased p-4 min-h-screen bg-canvas">
        <Story />
      </div>
    ),
  ],
};

export default preview;

