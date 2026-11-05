export const COOKIE_SESSION_NAME = 'hs_session';
export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

export type UserRole = 'platform_admin' | 'company_admin' | 'candidate';

export interface AuthenticatedUser {
  userId: string;
  orgId: string | null;
  role: UserRole;
  email: string;
}

export interface SessionData extends AuthenticatedUser {
  createdAt?: string;
  lastActiveAt?: string;
}

