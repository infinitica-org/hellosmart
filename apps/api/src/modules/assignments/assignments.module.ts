import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module.js';
import { AssessmentsModule } from '../assessments/assessments.module.js';
import { SubmissionsService } from '../submissions/submissions.service.js';
import { SessionActivityService } from '../workspaces/session-activity.service.js';
import { AssignmentsController } from './assignments.controller.js';
import { AssignmentsService } from './assignments.service.js';
import { CandidateTimingController } from './candidate-timing.controller.js';

@Module({
  imports: [AssessmentsModule, AuditModule],
  controllers: [AssignmentsController, CandidateTimingController],
  providers: [AssignmentsService, SessionActivityService, SubmissionsService],
  exports: [AssignmentsService, SubmissionsService, SessionActivityService],
})
export class AssignmentsModule {}
