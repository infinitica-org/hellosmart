import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ExtendAssignmentTimeDtoSchema } from '@hs/contracts';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { problem } from '../../common/errors/app-http.exception.js';
import {
  REQUEST_USER_KEY,
  type AuthenticatedRequest,
} from '../../common/guards/session.guard.js';
import { flattenZodErrors } from '../../common/validation/zod-errors.js';
import { AssignmentsService } from './assignments.service.js';

@Controller('company/assignments')
@Roles('company_admin', 'platform_admin')
export class AssignmentsController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Post(':id/extend-time')
  @HttpCode(200)
  async extendTime(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsed = ExtendAssignmentTimeDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid time extension payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }
    const actor = request[REQUEST_USER_KEY];
    const userAgent = request.headers['user-agent'];
    return this.assignments.extendTime({
      assignmentId: id,
      actor,
      dto: parsed.data,
      ip: request.ip,
      userAgent: typeof userAgent === 'string' ? userAgent : null,
      requestId: typeof request.id === 'string' ? request.id : null,
    });
  }
}
