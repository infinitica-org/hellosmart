/**
 * Safe redirect handling and open-redirect defense for HelloSmart.ai.
 *
 * Implements S0-T14-2 requirements:
 * - Reject absolute external URLs (e.g. https://evil.com, http://evil.com).
 * - Reject protocol-relative URLs (//evil.com, ///evil.com).
 * - Reject backslash variants (\evil.com, /\evil.com, \\evil.com).
 * - Reject null bytes, control characters, and dangerous URL encodings (%5c, %00, %0d, %0a).
 * - Enforce role-based portal boundaries: candidates to /candidate, company admins to /company,
 *   platform admins to /admin.
 * - Exact boundary matching: /company/assessments is valid, but /company-evil is rejected.
 */

const ROLE_DEFAULT_PORTALS: Record<string, string> = {
  platform_admin: '/admin',
  company_admin: '/company',
  candidate: '/candidate',
};

const PORTAL_NAMES: Record<string, string> = {
  admin: '/admin',
  company: '/company',
  candidate: '/candidate',
};

/**
 * Returns the default authorized portal root path for a given user role or portal identifier.
 */
export function getDefaultPortal(role?: string | null, portal?: string | null): string {
  if (portal && PORTAL_NAMES[portal]) {
    return PORTAL_NAMES[portal];
  }
  if (role && ROLE_DEFAULT_PORTALS[role]) {
    return ROLE_DEFAULT_PORTALS[role];
  }
  return '/login';
}

/**
 * Validates and sanitizes an untrusted redirect candidate target.
 *
 * Returns a clean relative path (with pathname, search, and hash) if safe,
 * or null if the input violates open-redirect constraints.
 */
export function sanitizeRedirectPath(target: string | null | undefined): string | null {
  if (!target || typeof target !== 'string') {
    return null;
  }

  const trimmed = target.trim();
  if (!trimmed) {
    return null;
  }

  // Reject ASCII control characters (0-31, 127) and null bytes
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return null;
  }

  // Reject dangerous encoded characters (%00, %0d, %0a, %5c)
  if (/%00|%0d|%0a|%5c/i.test(trimmed)) {
    return null;
  }

  // Decode URI components iteratively to catch multi-encoded protocol-relative slashes
  let decoded = trimmed;
  try {
    for (let i = 0; i < 3; i++) {
      if (!decoded.includes('%')) break;
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
  } catch {
    return null; // Malformed percent-encoding
  }

  // Reject backslashes in raw or decoded form
  if (trimmed.includes('\\') || decoded.includes('\\')) {
    return null;
  }

  // Reject decoded protocol-relative slashes or backslash variants
  if (decoded.startsWith('//') || decoded.startsWith('/\\') || decoded.startsWith('\\\\')) {
    return null;
  }

  // Reject explicit schemes in raw or decoded form (e.g. https:, http:, javascript:, data:, vbscript:)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) || /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)) {
    return null;
  }

  // Must begin with a single slash, not protocol-relative (//) or backslash variants (/\, \/)
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    trimmed.startsWith('/%2f') ||
    trimmed.startsWith('/%2F')
  ) {
    return null;
  }

  // Reject directory traversal sequences (/../, /./, or ending with /.. or /.)
  if (/(?:^|\/)\.\.?(?:\/|$)/.test(trimmed)) {
    return null;
  }

  try {
    const dummyOrigin = 'http://hs-dummy-safe.local';
    const parsed = new URL(trimmed, dummyOrigin);

    // Verify origin was not hijacked
    if (parsed.origin !== dummyOrigin) {
      return null;
    }

    // Path must start with single slash and not contain protocol-relative slashes
    if (!parsed.pathname.startsWith('/') || parsed.pathname.startsWith('//')) {
      return null;
    }

    // Path segments must not contain directory traversal attempts
    const segments = parsed.pathname.split('/');
    for (const segment of segments) {
      if (segment === '.' || segment === '..') {
        return null;
      }
    }

    // Reconstruct clean relative path: pathname + search + hash
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

/**
 * Checks whether a sanitized path resides strictly within the authorized portal boundary
 * for the user's role and portal.
 */
export function isValidPortalPath(path: string, role: string, portal?: string): boolean {
  const defaultPortal = getDefaultPortal(role, portal);
  if (defaultPortal === '/login') {
    return false;
  }

  // Exact match to portal root
  if (path === defaultPortal) {
    return true;
  }

  // Subpath with boundary delimiter (slash, query param, or hash fragment)
  if (
    path.startsWith(`${defaultPortal}/`) ||
    path.startsWith(`${defaultPortal}?`) ||
    path.startsWith(`${defaultPortal}#`)
  ) {
    return true;
  }

  // Disallow /company-evil or cross-role /admin for company_admin, etc.
  return false;
}

/**
 * Evaluates an untrusted `from` parameter against the user's authenticated role and portal.
 *
 * If `from` is a valid, sanitized path within the user's authorized portal boundary,
 * it returns that path. Otherwise, it safely falls back to the user's default portal root.
 */
export function getSafeRedirectUrl(
  from: string | null | undefined,
  role: string,
  portal?: string,
): string {
  const fallback = getDefaultPortal(role, portal);

  if (!from) {
    return fallback;
  }

  const sanitized = sanitizeRedirectPath(from);
  if (!sanitized) {
    return fallback;
  }

  if (isValidPortalPath(sanitized, role, portal)) {
    return sanitized;
  }

  return fallback;
}
