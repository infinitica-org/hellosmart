import type { MeDto, Portal } from '@hs/contracts';
import type { UserRole } from '../../common/types/user-context.js';

export function portalForRole(role: UserRole): Portal {
  switch (role) {
    case 'platform_admin':
      return 'admin';
    case 'company_admin':
      return 'company';
    case 'candidate':
      return 'candidate';
  }
}

export function toMeDto(input: {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  mustResetPassword: boolean;
  org: { id: string; name: string; logoUrl: string | null } | null;
}): MeDto {
  return {
    id: input.id,
    email: input.email,
    name: input.name,
    role: input.role,
    portal: portalForRole(input.role),
    mustResetPassword: input.mustResetPassword,
    org: input.org,
  };
}
