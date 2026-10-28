import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../types/user-context.js';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: UserRole[]): ReturnType<typeof SetMetadata> =>
  SetMetadata(ROLES_KEY, roles);
