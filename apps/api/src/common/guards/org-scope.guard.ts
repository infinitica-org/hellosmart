import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { problem } from '../errors/app-http.exception.js';
import { REQUEST_USER_KEY, type AuthenticatedRequest } from './session.guard.js';

@Injectable()
export class OrgScopeGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request[REQUEST_USER_KEY];
    if (!user) {
      return true;
    }

    if (user.role === 'platform_admin') {
      return true;
    }

    const params = request.params as Record<string, string | undefined>;
    const routeOrgId = params.orgId ?? params.org_id;
    if (!routeOrgId) {
      return true;
    }

    if (!user.orgId || user.orgId !== routeOrgId) {
      throw problem({
        title: 'Not Found',
        status: 404,
        detail: 'Resource not found',
        code: 'TENANT_NOT_FOUND',
      });
    }
    return true;
  }
}
