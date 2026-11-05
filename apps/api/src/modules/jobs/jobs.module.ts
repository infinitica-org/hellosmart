import { Module } from '@nestjs/common';
import { RetentionPurgeWorker } from './retention-purge.worker.js';
import { RetentionSchedulerService } from './retention-scheduler.service.js';
import { AutoSubmitWorker } from './auto-submit.worker.js';
import { EmailWorker } from './email.worker.js';
import { TimingJobsScheduler } from './timing-jobs.scheduler.js';
import {
  CANDIDATE_ARTIFACT_LOCATOR_PORT,
  EmptyCandidateArtifactLocator,
} from './candidate-artifact-locator.port.js';
import { StorageModule } from '../../common/storage/storage.module.js';
import { SessionModule } from '../session/session.module.js';
import { AssignmentsModule } from '../assignments/assignments.module.js';
import { EmailsModule } from '../emails/emails.module.js';
import { AuditModule } from '../../common/audit/audit.module.js';

@Module({
  imports: [StorageModule, SessionModule, AssignmentsModule, EmailsModule, AuditModule],
  providers: [
    RetentionPurgeWorker,
    RetentionSchedulerService,
    AutoSubmitWorker,
    EmailWorker,
    TimingJobsScheduler,
    {
      provide: CANDIDATE_ARTIFACT_LOCATOR_PORT,
      useClass: EmptyCandidateArtifactLocator,
    },
  ],
  exports: [RetentionPurgeWorker, AutoSubmitWorker, EmailWorker, CANDIDATE_ARTIFACT_LOCATOR_PORT],
})
export class JobsModule {}
