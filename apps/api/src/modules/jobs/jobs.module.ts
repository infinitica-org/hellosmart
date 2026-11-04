import { Module } from '@nestjs/common';
import { RetentionPurgeWorker } from './retention-purge.worker.js';
import { RetentionSchedulerService } from './retention-scheduler.service.js';
import {
  CANDIDATE_ARTIFACT_LOCATOR_PORT,
  EmptyCandidateArtifactLocator,
} from './candidate-artifact-locator.port.js';
import { StorageModule } from '../../common/storage/storage.module.js';
import { SessionModule } from '../session/session.module.js';

@Module({
  imports: [StorageModule, SessionModule],
  providers: [
    RetentionPurgeWorker,
    RetentionSchedulerService,
    {
      provide: CANDIDATE_ARTIFACT_LOCATOR_PORT,
      useClass: EmptyCandidateArtifactLocator,
    },
  ],
  exports: [RetentionPurgeWorker, CANDIDATE_ARTIFACT_LOCATOR_PORT],
})
export class JobsModule {}
