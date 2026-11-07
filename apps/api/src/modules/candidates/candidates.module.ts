import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller.js';
import { CandidatePortalController } from './candidate-portal.controller.js';
import { CandidatesService } from './candidates.service.js';
import { CandidateAssessmentsController } from './candidate-assessments.controller.js';
import { CandidateAssessmentsService } from './candidate-assessments.service.js';
import { MailService } from '../../common/services/mail.service.js';
import { SessionActivityService } from '../workspaces/session-activity.service.js';

@Module({
  controllers: [
    CandidatesController,
    CandidateAssessmentsController,
    CandidatePortalController,
  ],
  providers: [
    CandidatesService,
    CandidateAssessmentsService,
    MailService,
    SessionActivityService,
  ],
  exports: [CandidatesService, CandidateAssessmentsService, SessionActivityService],
})
export class CandidatesModule {}

