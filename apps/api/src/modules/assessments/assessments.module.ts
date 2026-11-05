import { Module } from '@nestjs/common';
import { AssessmentsController } from './assessments.controller.js';
import { AssessmentsService } from './assessments.service.js';
import { AssessmentsRepository } from './assessments.repository.js';
import { TimingService } from './timing.service.js';

@Module({
  controllers: [AssessmentsController],
  providers: [AssessmentsRepository, AssessmentsService, TimingService],
  exports: [AssessmentsRepository, AssessmentsService, TimingService],
})
export class AssessmentsModule {}
