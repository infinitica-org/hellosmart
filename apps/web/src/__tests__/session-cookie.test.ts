import { describe, expect, it } from 'vitest';
import {
  apiSessionCookieHeader,
  readSessionTokenFromCookies,
} from '../lib/session-cookie';

function cookieRequest(map: Record<string, string>) {
  return {
    cookies: {
      get(name: string) {
        const value = map[name];
        return value ? { value } : undefined;
      },
    },
  } as Parameters<typeof readSessionTokenFromCookies>[0];
}

describe('session cookie helpers', () => {
  it('prefers __Host-hs_session over hs_session', () => {
    expect(
      readSessionTokenFromCookies(
        cookieRequest({
          hs_session: 'plain',
          '__Host-hs_session': 'host-bound',
        }),
      ),
    ).toBe('host-bound');
  });

  it('forwards both cookie names and never uses Bearer', () => {
    const header = apiSessionCookieHeader('tok');
    expect(header).toContain('__Host-hs_session=tok');
    expect(header).toContain('hs_session=tok');
    expect(header.toLowerCase()).not.toContain('bearer');
  });
});
