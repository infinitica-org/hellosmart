'use client';

import { getMe, logout, logoutAllSessions, revokeSession, listSessions, type UserMe } from './api-client';

/**
 * Supported cross-tab authentication synchronization events.
 */
export type AuthBroadcastMessage =
  | { type: 'LOGOUT'; reason?: string }
  | { type: 'LOGIN'; role?: string }
  | { type: 'SESSION_EXTENDED'; timestamp: number }
  | { type: 'ACTIVITY_PING'; timestamp: number };

const AUTH_CHANNEL_NAME = 'hs-auth';

// Safe redirect validator (BR-25 / S0-T14-2)
export function isSafeRedirectPath(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  // Must begin with a single slash (relative path), not protocol-relative //
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return false;
  }

  // Reject unsafe schemes and backslash tricks
  if (trimmed.includes('\\') || trimmed.includes('\0')) {
    return false;
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('/javascript:') ||
    lower.startsWith('/data:') ||
    lower.startsWith('/vbscript:')
  ) {
    return false;
  }

  return true;
}

export function sanitizeRedirectPath(
  url: string | null | undefined,
  fallback = '/login',
): string {
  if (isSafeRedirectPath(url)) {
    return url as string;
  }
  return fallback;
}

class SessionClient {
  private channel: BroadcastChannel | null = null;
  private currentUser: UserMe | null = null;
  private listeners: Set<(event: AuthBroadcastMessage) => void> = new Set();
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent<AuthBroadcastMessage>) => {
          this.handleBroadcast(event.data);
        };
      } catch (err) {
        console.warn('[SessionClient] BroadcastChannel not supported in this environment', err);
      }
    }
  }

  public init(): void {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  public subscribe(listener: (event: AuthBroadcastMessage) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private handleBroadcast(data: AuthBroadcastMessage): void {
    // Notify all local subscribers
    this.listeners.forEach((listener) => {
      try {
        listener(data);
      } catch (err) {
        console.error('[SessionClient] Listener error:', err);
      }
    });

    if (data.type === 'LOGOUT') {
      this.currentUser = null;
      // Multi-tab logout sync: redirect other tabs within 1 second
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        const from = window.location.pathname;
        const target = `/login?reason=${encodeURIComponent(data.reason || 'session-expired')}${
          isSafeRedirectPath(from) && from !== '/' ? `&from=${encodeURIComponent(from)}` : ''
        }`;
        window.location.href = target;
      }
    } else if (data.type === 'LOGIN') {
      // Refresh current user profile in other open tabs
      this.refreshUser().catch(() => {});
    }
  }

  public broadcast(message: AuthBroadcastMessage): void {
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (err) {
        console.warn('[SessionClient] Failed to post broadcast message', err);
      }
    }
  }

  public async refreshUser(): Promise<UserMe | null> {
    try {
      const user = await getMe();
      this.currentUser = user;
      return user;
    } catch {
      this.currentUser = null;
      return null;
    }
  }

  public getCurrentUser(): UserMe | null {
    return this.currentUser;
  }

  public setCurrentUser(user: UserMe | null): void {
    this.currentUser = user;
    if (user) {
      this.broadcast({ type: 'LOGIN', role: user.role });
    }
  }

  /**
   * Handles user sign-out and notifies all open tabs via BroadcastChannel.
   */
  public async signOut(reason = 'user-logout'): Promise<void> {
    this.currentUser = null;
    try {
      await logout();
    } catch {
      // ignore network errors on sign-out
    }

    this.broadcast({ type: 'LOGOUT', reason });

    if (typeof window !== 'undefined') {
      const target =
        reason === 'session-expired'
          ? `/login?reason=session-expired`
          : `/login`;
      window.location.href = target;
    }
  }

  /**
   * Revokes all active sessions across all devices for this user.
   */
  public async signOutAllDevices(): Promise<void> {
    this.currentUser = null;
    try {
      await logoutAllSessions();
    } catch {
      // ignore
    }

    this.broadcast({ type: 'LOGOUT', reason: 'session-expired' });

    if (typeof window !== 'undefined') {
      window.location.href = '/login?reason=session-expired';
    }
  }

  /**
   * Extends the server-side session by validating against GET /me.
   * Returns true if server confirms session is valid.
   */
  public async extendSession(): Promise<boolean> {
    try {
      const user = await getMe();
      this.currentUser = user;
      this.broadcast({ type: 'SESSION_EXTENDED', timestamp: Date.now() });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Revokes a specific session.
   */
  public async revoke(sessionId: string): Promise<boolean> {
    try {
      await revokeSession(sessionId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lists all active sessions for current user.
   */
  public async getActiveSessions() {
    return await listSessions();
  }
}

export const sessionClient = new SessionClient();

