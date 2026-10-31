import { Module } from '@nestjs/common';
import { CompanyTemplatesController } from './company-templates.controller.js';

@Module({
  controllers: [CompanyTemplatesController],
  exports: [],
})
export class TemplatesModule {}

