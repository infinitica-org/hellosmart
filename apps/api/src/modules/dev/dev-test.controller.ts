import { Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { REQUEST_USER_KEY, type AuthenticatedRequest } from '../../common/guards/session.guard.js';
import type { UserContext } from '../../common/types/user-context.js';

/** Internal routes used by unit tests for guard and idempotency behaviour. Not part of the public contract. */
@Controller('_test')
export class DevTestController {
  @Roles('company_admin')
  @Get('org/:orgId/ping')
  orgPing(@Param('orgId') orgId: string): { orgId: string } {
    return { orgId };
  }

  @Roles('company_admin')
  @HttpCode(200)
  @Post('mutate')
  mutate(@Req() req: AuthenticatedRequest): { userId: string; at: string } {
    const user = req[REQUEST_USER_KEY] as UserContext;
    return { userId: user.userId, at: new Date().toISOString() };
  }
}
