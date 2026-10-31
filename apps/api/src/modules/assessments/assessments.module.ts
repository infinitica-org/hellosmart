import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller.js';
import { AssessmentsService } from './assessments.service.js';
import { AssessmentsRepository } from './assessments.repository.js';

@Module({
  controllers: [AssessmentsController],
  providers: [AssessmentsRepository, AssessmentsService],
  exports: [AssessmentsRepository, AssessmentsService],
})
export class AssessmentsModule {}
