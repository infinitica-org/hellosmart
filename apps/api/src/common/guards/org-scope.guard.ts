import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { problem } from '../errors/app-http.exception.js';
import { REQUEST_USER_KEY, type AuthenticatedRequest } from './session.guard.js';

function collectClaimedOrgIds(request: AuthenticatedRequest): string[] {
  const claimed = new Set<string>();
  const params = request.params as Record<string, string | undefined>;
  const query = request.query as Record<string, unknown>;
  const body = request.body as Record<string, unknown> | undefined;

  const maybeAdd = (value: unknown) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      claimed.add(value.trim());
    }
  };

  maybeAdd(params.orgId);
  maybeAdd(params.org_id);
  maybeAdd(query?.orgId);
  maybeAdd(query?.org_id);
  maybeAdd(body?.orgId);
  maybeAdd(body?.org_id);
  return [...claimed];
}

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

    const claimed = collectClaimedOrgIds(request);
    if (claimed.length === 0) {
      return true;
    }

    for (const claimedOrgId of claimed) {
      if (!user.orgId || user.orgId !== claimedOrgId) {
        throw problem({
          title: 'Not Found',
          status: 404,
          detail: 'Resource not found',
          code: 'TENANT_NOT_FOUND',
        });
      }
    }
    return true;
  }
}
