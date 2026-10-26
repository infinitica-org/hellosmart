import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Session } from '../session/session.interface.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Session | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
