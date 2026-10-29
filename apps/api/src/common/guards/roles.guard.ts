import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import {
  IS_PUBLIC_KEY,
  ROLES_KEY,
  UserRole,
} from '../constants/auth.constants.js';
import { ProblemDetailsException } from '../exceptions/problem-details.exception.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Skip if route is marked @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 2. Read required roles from metadata
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no roles specified, any authenticated session is permitted
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user || (request.raw as any)?.user;

    if (!user || !requiredRoles.includes(user.role)) {
      throw ProblemDetailsException.forbidden(
        'Your role is not authorized to access this resource.',
        'ROLE_FORBIDDEN',
      );
    }

    return true;
  }
}

