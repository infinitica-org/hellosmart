import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common';
import { WorkspaceEventDtoSchema } from '@hs/contracts';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { problem } from '../../common/errors/app-http.exception.js';
import {
  REQUEST_USER_KEY,
  type AuthenticatedRequest,
} from '../../common/guards/session.guard.js';
import { flattenZodErrors } from '../../common/validation/zod-errors.js';
import { AssignmentsService } from '../assignments/assignments.service.js';

@Controller('candidate')
@Roles('candidate')
export class CandidateTimingController {
  constructor(private readonly assignments: AssignmentsService) {}

  @Get('assessment/timing')
  async timing(@Query('assignmentId') assignmentId: string, @Req() request: AuthenticatedRequest) {
    if (!assignmentId) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'assignmentId is required.',
        code: 'VALIDATION_ERROR',
      });
    }
    return this.assignments.getTiming(assignmentId, request[REQUEST_USER_KEY]);
  }

  @Post('assignments/:id/connect')
  @HttpCode(200)
  async connect(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.assignments.connect(id, request[REQUEST_USER_KEY]);
  }

  @Post('assignments/:id/submit')
  @HttpCode(200)
  async submit(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.assignments.submit(id, request[REQUEST_USER_KEY]);
  }

  @Post('workspaces/:id/events')
  @HttpCode(200)
  async workspaceEvent(
    @Param('id') assignmentId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsed = WorkspaceEventDtoSchema.safeParse(body ?? { eventType: 'disconnect' });
    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid workspace event payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }
    return this.assignments.recordEvent({
      assignmentId,
      actor: request[REQUEST_USER_KEY],
      eventType: parsed.data.eventType,
      ip: request.ip,
    });
  }
}
