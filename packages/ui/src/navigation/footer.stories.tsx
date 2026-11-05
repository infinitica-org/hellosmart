import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Footer } from './footer';

const meta: Meta<typeof Footer> = {
  title: 'Navigation/Footer',
  component: Footer,
  tags: ['autodocs'],
  args: {
    variant: 'auth',
    brandName: 'HelloSmart.ai',
    showPoweredBy: true,
    showLogo: true,
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['auth', 'simple', 'marketing'],
    },
    showLogo: { control: 'boolean' },
    showPoweredBy: { control: 'boolean' },
    brandName: { control: 'text' },
    logoVariant: {
      control: 'radio',
      options: ['image', 'vector'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Footer>;

/**
 * Auth Footer
 * Clean, focused footer for authentication workflows (login, sign-in) with brand logo.
 */
export const Auth: Story = {
  name: 'Auth',
  args: {
    variant: 'auth',
    showLogo: true,
    authPrompt: 'Forgot your password?',
    authActionText: 'Reset Password',
    authActionHref: '/change-password',
    secondaryActionText: 'Need an account? Contact Admin',
    showPoweredBy: true,
    logoVariant: 'image',
  },
  render: (args) => (
    <div className="w-full max-w-lg mx-auto p-6 bg-canvas rounded-md border border-neutral-200 shadow-xs">
      <div className="p-8 bg-white rounded-xl border border-neutral-200 text-center mb-4">
        <h3 className="font-semibold text-neutral-800 text-base">Login</h3>
        <p className="text-xs text-neutral-500 mt-1">Sign in to your account</p>
      </div>
      <Footer {...args} />
    </div>
  ),
};

/**
 * Simple Footer
 * Minimal, single-line bottom footer with logo, copyright, and essential links.
 */
export const Simple: Story = {
  name: 'Simple',
  args: {
    variant: 'simple',
    showLogo: true,
    showPoweredBy: true,
    logoVariant: 'image',
  },
  render: (args) => (
    <div className="w-full bg-canvas py-8">
      <Footer {...args} />
    </div>
  ),
};

/**
 * Marketing Footer
 * Full multi-column footer with brand identity, solution categories, and resources.
 */
export const Marketing: Story = {
  name: 'Marketing',
  args: {
    variant: 'marketing',
    brandName: 'HelloSmart.ai',
    tagline: 'Real work simulation for hiring. AI-governed workspaces with independent reviewer agents.',
    showLogo: true,
    showPoweredBy: true,
    logoVariant: 'image',
  },
  render: (args) => (
    <div className="w-full">
      <Footer {...args} />
    </div>
  ),
};

/**
 * Password Reset Footer
 * Contextual prompt directing users back to sign in.
 */
export const PasswordReset: Story = {
  name: 'Password Reset',
  args: {
    variant: 'auth',
    showLogo: true,
    authPrompt: 'Remember your password?',
    authActionText: 'Back to Sign In →',
    authActionHref: '/login',
    secondaryActionText: 'Need help? Contact support@hellosmart.ai',
    secondaryActionHref: 'mailto:support@hellosmart.ai',
    showPoweredBy: true,
    logoVariant: 'image',
  },
  render: (args) => (
    <div className="w-full max-w-lg mx-auto p-6 bg-canvas rounded-md border border-neutral-200 shadow-xs">
      <div className="p-8 bg-white rounded-xl border border-neutral-200 text-center mb-4">
        <h3 className="font-semibold text-neutral-800 text-base">Reset Password</h3>
        <p className="text-xs text-neutral-500 mt-1">Create a new secure password</p>
      </div>
      <Footer {...args} />
    </div>
  ),
};


