import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Session } from '../session/session.interface.js';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: Session; headers: Record<string, string> }>();
    const session = request.user;
    const requestId = request.headers['x-request-id'] || '';

    if (!session) {
      throw new HttpException(
        {
          type: 'https://hellosmart.ai/problems/unauthorized',
          title: 'Unauthorized',
          status: HttpStatus.UNAUTHORIZED,
          detail: 'Authentication required for role verification.',
          code: 'UNAUTHORIZED',
          requestId,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    const hasRole = requiredRoles.includes(session.role);
    if (!hasRole) {
      // BR-25: Candidate sessions must never reach company or admin routes.
      // If a candidate accesses restricted company/admin routes, return 404 (BR-01 isolation).
      if (session.role === 'candidate') {
        throw new HttpException(
          {
            type: 'https://hellosmart.ai/problems/not-found',
            title: 'Not Found',
            status: HttpStatus.NOT_FOUND,
            detail: 'The requested resource was not found.',
            code: 'NOT_FOUND',
            requestId,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      throw new HttpException(
        {
          type: 'https://hellosmart.ai/problems/forbidden',
          title: 'Forbidden',
          status: HttpStatus.FORBIDDEN,
          detail: 'You do not have permission to perform this action.',
          code: 'FORBIDDEN',
          requestId,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
