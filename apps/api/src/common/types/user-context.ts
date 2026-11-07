export type UserRole = 'platform_admin' | 'company_admin' | 'candidate';

export interface UserContext {
  userId: string;
  email: string;
  role: UserRole;
  orgId: string | null;
}

export type AuthenticatedUser = UserContext;

