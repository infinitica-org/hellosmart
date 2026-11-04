import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import {
  CSRF_HEADER_NAME,
  SAFE_METHODS,
  STATE_CHANGING_METHODS,
} from '../../config/security.config.js';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator.js';
import { problem } from '../errors/app-http.exception.js';
import { requestHasSessionCookie } from '../../modules/session/session-cookie.js';

@Injectable()
export class CsrfOriginGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(APP_CONFIG) private readonly config: Config,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const method = request.method?.toUpperCase() || 'GET';

    // 1. Safe HTTP methods (GET, HEAD, OPTIONS) do not alter server state
    if (SAFE_METHODS.includes(method)) {
      return true;
    }

    // 2. Only guard state-changing methods
    if (!STATE_CHANGING_METHODS.includes(method)) {
      return true;
    }

    // 3. Check for route-level or controller-level @SkipCsrf() exemption
    const isExempt = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isExempt) {
      return true;
    }

    // 4. Identify whether request is from a browser or carries ambient session credentials
    const originHeader = request.headers['origin'];
    const refererHeader = request.headers['referer'];
    const hasSessionCookie = requestHasSessionCookie(request);
    const secFetchSite = request.headers['sec-fetch-site'];

    const isBrowserOrAmbientRequest = Boolean(
      originHeader || refererHeader || hasSessionCookie || secFetchSite,
    );

    // Reconcile with CORS: If a request has no Origin, no Referer, no ambient session cookie,
    // and no browser Fetch Metadata, it is a non-browser caller (curl, server-to-server, CLI, test)
    // that is not subject to browser-driven cross-site request forgery.
    if (!isBrowserOrAmbientRequest) {
      return true;
    }

    // 5. Require custom anti-CSRF header (X-HS-CSRF) on all browser state-changing requests.
    // Presence of the custom header is the defense (Fetch metadata + cookie); value is not a secret.
    const csrfHeader = request.headers[CSRF_HEADER_NAME] || request.headers['x-hs-csrf'];
    if (!csrfHeader || (typeof csrfHeader === 'string' && csrfHeader.trim() === '')) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'CSRF protection check failed: missing required X-HS-CSRF header',
        code: 'CSRF_TOKEN_MISSING',
      });
    }

    // 6. Origin and Referer validation against trusted origins
    const trustedOrigins = this.config.CORS_ORIGINS || [];

    if (typeof originHeader === 'string' && originHeader.trim() !== '') {
      let normalizedOrigin: string;
      try {
        normalizedOrigin = new URL(originHeader.trim()).origin;
      } catch {
        throw problem({
          title: 'Forbidden',
          status: 403,
          detail: 'CSRF protection check failed: malformed Origin header',
          code: 'CSRF_INVALID_ORIGIN',
        });
      }

      if (!trustedOrigins.includes(normalizedOrigin)) {
        throw problem({
          title: 'Forbidden',
          status: 403,
          detail: `CSRF protection check failed: untrusted origin '${normalizedOrigin}'`,
          code: 'CSRF_INVALID_ORIGIN',
        });
      }

      return true;
    }

    // If Origin is absent, fallback to Referer verification using strict URL origin parsing
    if (typeof refererHeader === 'string' && refererHeader.trim() !== '') {
      let refererOrigin: string;
      try {
        refererOrigin = new URL(refererHeader.trim()).origin;
      } catch {
        throw problem({
          title: 'Forbidden',
          status: 403,
          detail: 'CSRF protection check failed: malformed Referer header',
          code: 'CSRF_INVALID_REFERER',
        });
      }

      if (!trustedOrigins.includes(refererOrigin)) {
        throw problem({
          title: 'Forbidden',
          status: 403,
          detail: `CSRF protection check failed: untrusted referer origin '${refererOrigin}'`,
          code: 'CSRF_INVALID_REFERER',
        });
      }

      return true;
    }

    // 7. When both Origin and Referer are absent on a browser/ambient request:
    // Block if browser Fetch Metadata indicates a cross-site request
    if (typeof secFetchSite === 'string' && secFetchSite === 'cross-site') {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'CSRF protection check failed: cross-site request rejected',
        code: 'CSRF_CROSS_SITE_BLOCKED',
      });
    }

    // If an ambient session cookie is present but both Origin and Referer are missing
    if (hasSessionCookie) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'CSRF protection check failed: ambient session request missing Origin and Referer headers',
        code: 'CSRF_ORIGIN_MISSING',
      });
    }

    return true;
  }
}
