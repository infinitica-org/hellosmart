import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { problem } from '../errors/app-http.exception.js';
import type { UserRole } from '../types/user-context.js';
import { REQUEST_USER_KEY, type AuthenticatedRequest } from './session.guard.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Route is missing @Roles()',
        code: 'ROLES_NOT_CONFIGURED',
      });
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request[REQUEST_USER_KEY];
    if (!user || !required.includes(user.role)) {
      throw problem({
        title: 'Forbidden',
        status: 403,
        detail: 'Insufficient role for this route',
        code: 'FORBIDDEN',
      });
    }
    return true;
  }
}
