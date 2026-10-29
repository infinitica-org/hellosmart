import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AuthenticatedUser } from '../constants/auth.constants.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser;
  }
}

/**
 * Parameter decorator to extract the authenticated user from the request.
 * Usage:
 *   @Get('me')
 *   getMe(@CurrentUser() user: AuthenticatedUser)
 *   @Get('id')
 *   getId(@CurrentUser('userId') userId: string)
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): AuthenticatedUser | any => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const user = request.user;
    if (!user) {
      return undefined;
    }
    return data ? user[data] : user;
  },
);

