import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  AdminWorkspaceQueryDtoSchema,
  EmergencyDestroyWorkspaceDtoSchema,
  type AdminWorkspaceQueryDto,
  type EmergencyDestroyWorkspaceDto,
} from '@hs/contracts';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { problem } from '../../common/errors/app-http.exception.js';
import { flattenZodErrors } from '../../common/validation/zod-errors.js';
import {
  REQUEST_USER_KEY,
  type AuthenticatedRequest,
} from '../../common/guards/session.guard.js';
import type { RequestMeta } from '../auth/auth.service.js';
import { AdminWorkspacesService } from './admin-workspaces.service.js';

const uuidParamSchema = z.string().uuid();

@Controller('admin/workspaces')
@Roles('platform_admin')
export class AdminWorkspacesController {
  constructor(
    @Inject(AdminWorkspacesService)
    private readonly workspacesService: AdminWorkspacesService,
  ) {}

  private extractActor(req: any) {
    const user = req[REQUEST_USER_KEY] || req.user;
    if (!user) {
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required for administrative access.',
        code: 'UNAUTHORIZED',
      });
    }
    return user;
  }

  private extractMeta(req: any): RequestMeta {
    return {
      ip: req.ip || req.socket?.remoteAddress || null,
      userAgent: req.headers?.['user-agent'] || null,
      requestId: (req.id as string) || (req.headers?.['x-request-id'] as string) || null,
    };
  }

  @Get()
  async list(@Query() query: unknown, @Req() req: AuthenticatedRequest) {
    const actor = this.extractActor(req);
    const parsed = AdminWorkspaceQueryDtoSchema.safeParse(query);

    if (!parsed.success) {
      throw problem({
        title: 'Validation Error',
        status: 422,
        detail: 'Invalid workspace query parameters',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.workspacesService.listWorkspaces(parsed.data, actor);
  }

  @Get(':id')
  async getDetail(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const actor = this.extractActor(req);
    const idParsed = uuidParamSchema.safeParse(id);
    if (!idParsed.success) {
      throw problem({
        title: 'Validation Error',
        status: 422,
        detail: 'Workspace ID must be a valid UUID',
        code: 'VALIDATION_ERROR',
      });
    }

    return await this.workspacesService.getWorkspaceDetail(id, actor);
  }

  @Post(':id/destroy')
  @HttpCode(200)
  async destroy(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthenticatedRequest,
  ) {
    const actor = this.extractActor(req);
    const idParsed = uuidParamSchema.safeParse(id);
    if (!idParsed.success) {
      throw problem({
        title: 'Validation Error',
        status: 422,
        detail: 'Workspace ID must be a valid UUID',
        code: 'VALIDATION_ERROR',
      });
    }

    const parsed = EmergencyDestroyWorkspaceDtoSchema.safeParse(body);
    if (!parsed.success) {
      throw problem({
        title: 'Validation Error',
        status: 422,
        detail: 'Invalid emergency destroy payload',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    const meta = this.extractMeta(req);
    return await this.workspacesService.destroyWorkspace(id, parsed.data, actor, meta);
  }
}

