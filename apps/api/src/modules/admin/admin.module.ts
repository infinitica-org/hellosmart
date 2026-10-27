import { Module } from '@nestjs/common';
import { AdminOrganizationsController } from './admin-organizations.controller.js';
import { AdminOrganizationsService } from './admin-organizations.service.js';

@Module({
  controllers: [AdminOrganizationsController],
  providers: [AdminOrganizationsService],
})
export class AdminModule {}
