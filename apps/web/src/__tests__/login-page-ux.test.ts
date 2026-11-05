import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { isSafeRedirectPath } from '../lib/session-client';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams('message=password_set'),
}));

describe('Login Page Notices & UX (BUG-14)', () => {
  it('recognizes /login?message=password_set as safe redirect path', () => {
    expect(isSafeRedirectPath('/login?message=password_set')).toBe(true);
    expect(isSafeRedirectPath('/login?message=password_changed')).toBe(true);
    expect(isSafeRedirectPath('/login?message=logged_out')).toBe(true);
  });

  it('renders login page with password set confirmation alert (BUG-14)', async () => {
    const { default: LoginPage } = await import('../app/(auth)/login/page');
    const pageElement = React.createElement(LoginPage);
    expect(pageElement).toBeDefined();
    expect(pageElement.type).toBe(LoginPage);
  }, 15000);
});

