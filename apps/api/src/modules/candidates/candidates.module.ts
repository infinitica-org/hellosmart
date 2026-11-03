import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller.js';
import { CandidatesService } from './candidates.service.js';
import { CandidateAssessmentsController } from './candidate-assessments.controller.js';
import { CandidateAssessmentsService } from './candidate-assessments.service.js';
import { MailService } from '../../common/services/mail.service.js';

@Module({
  controllers: [CandidatesController, CandidateAssessmentsController],
  providers: [CandidatesService, CandidateAssessmentsService, MailService],
  exports: [CandidatesService, CandidateAssessmentsService],
})
export class CandidatesModule {}
