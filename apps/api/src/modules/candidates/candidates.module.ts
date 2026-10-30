import { Module } from '@nestjs/common';
import { CandidateAssignmentsController } from './candidate-assignments.controller.js';
import { CandidatesController } from './candidates.controller.js';
import { CandidatesService } from './candidates.service.js';
import { MailService } from '../../common/services/mail.service.js';

@Module({
  controllers: [CandidatesController, CandidateAssignmentsController],
  providers: [CandidatesService, MailService],
  exports: [CandidatesService],
})
export class CandidatesModule {}
