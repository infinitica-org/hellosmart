import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: ('platform_admin' | 'company_admin' | 'candidate')[]) =>
  SetMetadata(ROLES_KEY, roles);
