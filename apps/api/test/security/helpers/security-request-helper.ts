import type { NestFastifyApplication } from '@nestjs/platform-fastify';

export interface SecRequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' | 'HEAD' | 'OPTIONS';
  url: string;
  sessionToken?: string;
  payload?: any;
  headers?: Record<string, string>;
  omitCsrf?: boolean;
  omitOrigin?: boolean;
  customOrigin?: string;
}

export interface SecResponse {
  statusCode: number;
  body: string;
  json: any;
  headers: Record<string, any>;
  cookies: Array<{ name: string; value: string }>;
}

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * Wraps app.inject with standard anti-CSRF headers, trusted origin, and session cookies
 * to ensure that security tests focus on authorization and tenancy logic rather than
 * tripping browser anti-CSRF guards by accident.
 */
export async function injectSecRequest(
  app: NestFastifyApplication,
  options: SecRequestOptions,
): Promise<SecResponse> {
  const method = options.method.toUpperCase() as SecRequestOptions['method'];
  const reqHeaders: Record<string, string> = { ...(options.headers || {}) };

  // 1. Session Cookie Attachment
  if (options.sessionToken) {
    const existingCookie = reqHeaders['cookie'] || reqHeaders['Cookie'] || '';
    const sessionCookieStr = `hs_session=${options.sessionToken}`;
    reqHeaders['cookie'] = existingCookie
      ? `${existingCookie}; ${sessionCookieStr}`
      : sessionCookieStr;
  }

  // 2. Anti-CSRF Header and Origin Handling for State-Changing Requests
  if (STATE_CHANGING_METHODS.includes(method)) {
    if (!options.omitCsrf && !reqHeaders['x-hs-csrf'] && !reqHeaders['X-HS-CSRF']) {
      reqHeaders['x-hs-csrf'] = '1';
    }

    if (!options.omitOrigin && !reqHeaders['origin'] && !reqHeaders['Origin']) {
      reqHeaders['origin'] = options.customOrigin || 'http://localhost:3000';
    }
  }

  const res = await app.inject({
    method,
    url: options.url,
    payload: options.payload,
    headers: reqHeaders,
  });

  let parsedJson: any = null;
  try {
    parsedJson = res.json();
  } catch {
    parsedJson = null;
  }

  return {
    statusCode: res.statusCode,
    body: res.body,
    json: parsedJson,
    headers: res.headers,
    cookies: (res as any).cookies || [],
  };
}
