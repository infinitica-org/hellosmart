import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminMetricsController } from './admin-metrics.controller.js';
import { AdminOrganizationsController } from './admin-organizations.controller.js';
import { AdminOrganizationsService } from './admin-organizations.service.js';
import { AdminAuditController } from './admin-audit.controller.js';
import { AdminAuditService } from './admin-audit.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminOrganizationsController, AdminMetricsController, AdminAuditController],
  providers: [AdminOrganizationsService, AdminAuditService],
})
export class AdminModule {}
