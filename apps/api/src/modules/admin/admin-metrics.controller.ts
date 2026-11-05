import { Controller, Get, Inject } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AdminOrganizationsService } from './admin-organizations.service.js';

@Controller('admin/metrics')
@Roles('platform_admin')
export class AdminMetricsController {
  constructor(
    @Inject(AdminOrganizationsService)
    private readonly orgs: AdminOrganizationsService,
  ) {}

  @Get()
  async getMetrics() {
    return await this.orgs.getMetrics();
  }
}

