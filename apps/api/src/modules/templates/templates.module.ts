import { Module } from '@nestjs/common';
import { CompanyTemplatesController } from './company-templates.controller.js';
import { AdminTemplatesController } from './admin-templates.controller.js';
import { TemplatesService } from './templates.service.js';
import { TemplatesRepository } from './templates.repository.js';

@Module({
  controllers: [CompanyTemplatesController, AdminTemplatesController],
  providers: [TemplatesRepository, TemplatesService],
  exports: [TemplatesRepository, TemplatesService],
})
export class TemplatesModule {}
