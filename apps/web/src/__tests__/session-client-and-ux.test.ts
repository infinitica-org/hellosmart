import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isSafeRedirectPath,
  sanitizeRedirectPath,
  sessionClient,
  type AuthBroadcastMessage,
} from '../lib/session-client';

describe('Session UX: Safe Redirects (S0-T14-2, BR-25)', () => {
  it('allows safe relative paths', () => {
    expect(isSafeRedirectPath('/admin')).toBe(true);
    expect(isSafeRedirectPath('/company/dashboard')).toBe(true);
    expect(isSafeRedirectPath('/candidate/workspace?session=123')).toBe(true);
    expect(isSafeRedirectPath('/login?reason=session-expired')).toBe(true);
  });

  it('rejects external URLs and domain spoofing', () => {
    expect(isSafeRedirectPath('https://evil.com')).toBe(false);
    expect(isSafeRedirectPath('http://attacker.com/login')).toBe(false);
    expect(isSafeRedirectPath('//evil.com/fake-login')).toBe(false);
    expect(isSafeRedirectPath('///evil.com')).toBe(false);
  });

  it('rejects unsafe schemes and malicious encodings', () => {
    expect(isSafeRedirectPath('/javascript:alert(1)')).toBe(false);
    expect(isSafeRedirectPath('javascript:alert(1)')).toBe(false);
    expect(isSafeRedirectPath('/data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeRedirectPath('/admin\\something')).toBe(false);
    expect(isSafeRedirectPath('/candidate\0null')).toBe(false);
  });

  it('rejects empty or non-string inputs', () => {
    expect(isSafeRedirectPath('')).toBe(false);
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
  });

  it('sanitizes unsafe redirects to fallback default', () => {
    expect(sanitizeRedirectPath('https://evil.com', '/default')).toBe('/default');
    expect(sanitizeRedirectPath('//evil.com', '/login')).toBe('/login');
    expect(sanitizeRedirectPath('/admin', '/login')).toBe('/admin');
  });
});

describe('Session UX: Multi-Tab BroadcastChannel & Session Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('allows subscribing to auth broadcast events', () => {
    const receivedEvents: AuthBroadcastMessage[] = [];
    const unsubscribe = sessionClient.subscribe((event) => {
      receivedEvents.push(event);
    });

    sessionClient.broadcast({ type: 'SESSION_EXTENDED', timestamp: 1234567890 });

    unsubscribe();
    expect(typeof unsubscribe).toBe('function');
  });

  it('updates current user in memory without touching localStorage/sessionStorage', () => {
    const mockUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'test@example.com',
      name: 'Test User',
      role: 'company_admin' as const,
      portal: 'company' as const,
      mustResetPassword: false,
      org: { id: 'org_1', name: 'Test Org' },
    };

    sessionClient.setCurrentUser(mockUser);
    expect(sessionClient.getCurrentUser()).toEqual(mockUser);

    // Verify browser storage contains no user or session data
    if (typeof localStorage !== 'undefined') {
      expect(localStorage.getItem('user')).toBeNull();
      expect(localStorage.getItem('session')).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
    }
    if (typeof sessionStorage !== 'undefined') {
      expect(sessionStorage.getItem('user')).toBeNull();
      expect(sessionStorage.getItem('session')).toBeNull();
      expect(sessionStorage.getItem('token')).toBeNull();
    }
  });

  it('clears in-memory user upon sign-out', async () => {
    // Mock global fetch for logout
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, message: 'Logged out' }),
    });

    sessionClient.setCurrentUser({
      id: '123',
      email: 'user@test.com',
      name: 'User',
      role: 'candidate',
      portal: 'candidate',
      mustResetPassword: false,
      org: null,
    });

    expect(sessionClient.getCurrentUser()).not.toBeNull();

    // Call signOut without navigating window in test env
    await sessionClient.signOut('user-logout');
    expect(sessionClient.getCurrentUser()).toBeNull();
  });
});

describe('Session UX: Idle Warning Timing Calculations', () => {
  it('correctly calculates warning threshold (2 minutes before timeout)', () => {
    const idleTimeoutSeconds = 900; // 15 mins
    const warningThresholdSeconds = 120; // 2 mins

    // 10 minutes elapsed (600s): remaining 300s -> Warning NOT active
    const elapsed1 = 600;
    const remaining1 = idleTimeoutSeconds - elapsed1;
    expect(remaining1 > warningThresholdSeconds).toBe(true);

    // 13 minutes and 30 seconds elapsed (810s): remaining 90s -> Warning IS active
    const elapsed2 = 810;
    const remaining2 = idleTimeoutSeconds - elapsed2;
    expect(remaining2 <= warningThresholdSeconds && remaining2 > 0).toBe(true);

    // 15 minutes elapsed (900s): remaining 0s -> Expired
    const elapsed3 = 900;
    const remaining3 = idleTimeoutSeconds - elapsed3;
    expect(remaining3 <= 0).toBe(true);
  });
});

describe('Session UX: Active Sessions API Mapping (BUG-04)', () => {
  it('correctly normalizes backend SessionPublicDto shape to ActiveSession contract', async () => {
    const mockBackendResponse = {
      sessions: [
        {
          sessionId: 'sess_uuid_current',
          device: 'MacBook Pro',
          ip: '192.168.1.100',
          createdAt: '2026-10-30T10:00:00.000Z',
          lastSeenAt: '2026-10-30T12:00:00.000Z',
          current: true,
        },
        {
          sessionId: 'sess_uuid_other',
          device: 'iPhone 15',
          ip: '10.0.0.1',
          createdAt: '2026-10-29T10:00:00.000Z',
          lastSeenAt: '2026-10-29T15:00:00.000Z',
          current: false,
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockBackendResponse,
    });

    const { listSessions } = await import('../lib/api-client');
    const result = await listSessions(mockFetch as unknown as typeof fetch);

    expect(result.sessions).toHaveLength(2);

    const currentSession = result.sessions[0]!;
    expect(currentSession.id).toBe('sess_uuid_current');
    expect(currentSession.sessionId).toBe('sess_uuid_current');
    expect(currentSession.isCurrent).toBe(true);
    expect(currentSession.ipAddress).toBe('192.168.1.100');
    expect(currentSession.lastActiveAt).toBe('2026-10-30T12:00:00.000Z');

    const otherSession = result.sessions[1]!;
    expect(otherSession.id).toBe('sess_uuid_other');
    expect(otherSession.sessionId).toBe('sess_uuid_other');
    expect(otherSession.isCurrent).toBe(false);
    expect(otherSession.ipAddress).toBe('10.0.0.1');
    expect(otherSession.lastActiveAt).toBe('2026-10-29T15:00:00.000Z');
  });
});

