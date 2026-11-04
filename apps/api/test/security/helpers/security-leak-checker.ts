export interface LeakCheckOptions {
  checkBody?: boolean;
  checkHeaders?: boolean;
  checkCookies?: boolean;
  excludeTokens?: string[];
}

/**
 * Asserts that a response contains zero occurrences of another tenant's private identifiers
 * in its body, headers, or cookies.
 *
 * Exclude tokens (such as the exact ID the attacker passed in the URL path, which the server echoes
 * in "Resource <id> not found" messages) can be passed in `options.excludeTokens`.
 */
export function assertZeroTenantLeak(
  res: {
    statusCode?: number;
    body?: any;
    headers?: Record<string, any>;
    cookies?: Array<{ name: string; value: string }>;
  },
  forbiddenIdentifiers: Array<string | null | undefined>,
  options: LeakCheckOptions = { checkBody: true, checkHeaders: true, checkCookies: true },
): void {
  const excluded = new Set(
    (options.excludeTokens || [])
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
      .map((t) => t.trim().toLowerCase()),
  );

  // Filter out falsy, empty, short strings (< 4 chars), or explicitly excluded request parameters
  const validTokens = forbiddenIdentifiers
    .filter((id): id is string => typeof id === 'string' && id.trim().length >= 4)
    .map((id) => id.trim())
    .filter((token) => !excluded.has(token.toLowerCase()));

  if (validTokens.length === 0) {
    return;
  }

  // 1. Inspect Response Body
  if (options.checkBody !== false && res.body !== undefined && res.body !== null) {
    const rawBody = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
    for (const token of validTokens) {
      if (rawBody.toLowerCase().includes(token.toLowerCase())) {
        throw new Error(
          `SECURITY LEAK DETECTED in response body! Found foreign tenant identifier: "${token}". Response body: ${rawBody}`,
        );
      }
    }
  }

  // 2. Inspect Response Headers
  if (options.checkHeaders !== false && res.headers) {
    const rawHeaders = JSON.stringify(res.headers);
    for (const token of validTokens) {
      if (rawHeaders.toLowerCase().includes(token.toLowerCase())) {
        throw new Error(
          `SECURITY LEAK DETECTED in response headers! Found foreign tenant identifier: "${token}". Response headers: ${rawHeaders}`,
        );
      }
    }
  }

  // 3. Inspect Response Cookies
  if (options.checkCookies !== false && res.cookies && res.cookies.length > 0) {
    const rawCookies = JSON.stringify(res.cookies);
    for (const token of validTokens) {
      if (rawCookies.toLowerCase().includes(token.toLowerCase())) {
        throw new Error(
          `SECURITY LEAK DETECTED in response cookies! Found foreign tenant identifier: "${token}". Response cookies: ${rawCookies}`,
        );
      }
    }
  }
}
