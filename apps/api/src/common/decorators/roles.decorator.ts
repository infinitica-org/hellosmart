import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { ROLES_KEY, UserRole } from '../constants/auth.constants.js';

/**
 * Specifies the roles permitted to access a protected route.
 * Evaluated by RolesGuard.
 */
export const Roles = (...roles: UserRole[]): CustomDecorator<string> => SetMetadata(ROLES_KEY, roles);

