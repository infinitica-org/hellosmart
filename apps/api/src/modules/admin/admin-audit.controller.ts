import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import {
  AuditLogQueryDtoSchema,
} from '@hs/contracts';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { problem } from '../../common/errors/app-http.exception.js';
import { flattenZodErrors } from '../../common/validation/zod-errors.js';
import { AdminAuditService } from './admin-audit.service.js';

@Controller('admin/audit')
@Roles('platform_admin')
export class AdminAuditController {
  constructor(
    @Inject(AdminAuditService)
    private readonly auditService: AdminAuditService,
  ) {}

  @Get()
  async list(@Query() query: unknown) {
    const parsed = AuditLogQueryDtoSchema.safeParse(query);

    if (!parsed.success) {
      throw problem({
        title: 'Unprocessable Entity',
        status: 422,
        detail: 'Invalid query parameters for audit query',
        code: 'VALIDATION_ERROR',
        errors: flattenZodErrors(parsed.error),
      });
    }

    return await this.auditService.listAuditEvents(parsed.data);
  }

  @Post('verify-chain')
  @HttpCode(200)
  async verifyChain() {
    return await this.auditService.verifyAuditChain();
  }
}
