import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminMetricsController } from './admin-metrics.controller.js';
import { AdminOrganizationsController } from './admin-organizations.controller.js';
import { AdminOrganizationsService } from './admin-organizations.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminOrganizationsController, AdminMetricsController],
  providers: [AdminOrganizationsService],
})
export class AdminModule {}
