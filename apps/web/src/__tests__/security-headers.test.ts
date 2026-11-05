import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import {
  extractOrigin,
  buildCspDirectives,
  applySecurityHeaders,
  middleware,
} from '../middleware';

describe('Web Security Headers & CSP (S0-T14-2)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('extractOrigin', () => {
    it('extracts origin without paths, queries, or fragments', () => {
      expect(extractOrigin('http://localhost:4000/api/v1')).toBe('http://localhost:4000');
      expect(extractOrigin('https://api.hellosmart.ai/api/v1/auth/login?test=1#top')).toBe(
        'https://api.hellosmart.ai',
      );
      expect(extractOrigin('https://api.custom.com:8443/path')).toBe('https://api.custom.com:8443');
    });

    it('returns null for undefined, empty, or invalid URLs', () => {
      expect(extractOrigin(undefined)).toBeNull();
      expect(extractOrigin('')).toBeNull();
      expect(extractOrigin('invalid-url-string')).toBeNull();
    });
  });

  describe('buildCspDirectives', () => {
    it('enforces strict nonce-based script policy without unsafe-eval/unsafe-inline in production', () => {
      // @ts-expect-error override env for test
      process.env.NODE_ENV = 'production';
      process.env.NEXT_PUBLIC_API_URL = 'https://api.hellosmart.ai/api/v1';

      const nonce = 'test-nonce-base64-1234';
      const csp = buildCspDirectives(nonce);

      // Must include nonce and strict-dynamic
      expect(csp).toContain(`'nonce-${nonce}'`);
      expect(csp).toContain("'strict-dynamic'");

      // Extract script-src directive
      const scriptSrcDirective = csp
        .split(';')
        .map((d) => d.trim())
        .find((d) => d.startsWith('script-src'));

      expect(scriptSrcDirective).toBeDefined();
      expect(scriptSrcDirective).not.toContain("'unsafe-eval'");
      expect(scriptSrcDirective).not.toContain("'unsafe-inline'");

      // Mandatory structural directives
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("form-action 'self'");

      // connect-src must use origin only, never path, and must not include broad https:/ws: in production
      expect(csp).toContain('connect-src');
      expect(csp).toContain('https://api.hellosmart.ai');
      expect(csp).not.toContain('/api/v1');
      const connectDirective = csp
        .split(';')
        .map((d) => d.trim())
        .find((d) => d.startsWith('connect-src'));
      expect(connectDirective).toBeDefined();
      expect(connectDirective).not.toMatch(/\bhttps:\b/);
      expect(connectDirective).not.toMatch(/\bws:\b/);
      expect(connectDirective).not.toMatch(/\bwss:\b/);
    });

    it('permits unsafe-eval and unsafe-inline in development for Next.js Fast Refresh', () => {
      // @ts-expect-error override env for test
      process.env.NODE_ENV = 'development';
      const csp = buildCspDirectives('dev-nonce');

      const scriptSrcDirective = csp
        .split(';')
        .map((d) => d.trim())
        .find((d) => d.startsWith('script-src'));

      expect(scriptSrcDirective).toContain("'unsafe-eval'");
      expect(scriptSrcDirective).toContain("'unsafe-inline'");
    });
  });

  describe('applySecurityHeaders', () => {
    it('sets all mandatory baseline security headers', () => {
      const res = NextResponse.next();
      res.headers.set('X-Powered-By', 'Next.js');

      applySecurityHeaders(res, 'test-nonce', '/company');

      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
      expect(res.headers.get('Permissions-Policy')).toBe(
        'camera=(), microphone=(), geolocation=()',
      );
      expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('x-nonce')).toBe('test-nonce');
      expect(res.headers.get('Content-Security-Policy')).toBeDefined();

      // Suppresses X-Powered-By
      expect(res.headers.get('X-Powered-By')).toBeNull();
      expect(res.headers.get('x-powered-by')).toBeNull();
    });

    it('sets Strict-Transport-Security in production', () => {
      // @ts-expect-error override env for test
      process.env.NODE_ENV = 'production';
      const res = NextResponse.next();
      applySecurityHeaders(res, 'prod-nonce', '/admin');

      const hsts = res.headers.get('Strict-Transport-Security');
      expect(hsts).toBe('max-age=63072000; includeSubDomains; preload');
    });

    it('omits Strict-Transport-Security in local development to avoid localhost lockouts', () => {
      // @ts-expect-error override env for test
      process.env.NODE_ENV = 'development';
      const res = NextResponse.next();
      applySecurityHeaders(res, 'dev-nonce', '/candidate');

      expect(res.headers.get('Strict-Transport-Security')).toBeNull();
    });

    it('uses strict no-referrer on sensitive routes (password reset / login)', () => {
      const resReset = NextResponse.next();
      applySecurityHeaders(resReset, 'nonce-1', '/change-password');
      expect(resReset.headers.get('Referrer-Policy')).toBe('no-referrer');

      const resLogin = NextResponse.next();
      applySecurityHeaders(resLogin, 'nonce-2', '/login');
      expect(resLogin.headers.get('Referrer-Policy')).toBe('no-referrer');

      const resRedirectReset = NextResponse.redirect(new URL('http://localhost:3000/set-password'));
      applySecurityHeaders(resRedirectReset, 'nonce-3');
      expect(resRedirectReset.headers.get('Referrer-Policy')).toBe('no-referrer');
    });
  });

  describe('middleware end-to-end headers integration', () => {
    it('attaches security headers and nonces to public responses', async () => {
      const req = new NextRequest('http://localhost:3000/login');
      const res = await middleware(req);

      expect(res.headers.get('Content-Security-Policy')).toBeDefined();
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
      expect(res.headers.get('x-nonce')).toBeDefined();
    });
  });
});
