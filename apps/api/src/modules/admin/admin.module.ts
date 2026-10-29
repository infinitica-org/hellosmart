import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminOrganizationsController } from './admin-organizations.controller.js';
import { AdminOrganizationsService } from './admin-organizations.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AdminOrganizationsController],
  providers: [AdminOrganizationsService],
})
export class AdminModule {}
