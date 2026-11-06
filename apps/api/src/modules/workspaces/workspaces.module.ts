import { Module } from '@nestjs/common';
import { AuditModule } from '../../common/audit/audit.module.js';
import { StorageModule } from '../../common/storage/storage.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PgSubmissionRegistryAdapter } from './adapters/pg-submission-registry.adapter.js';
import { PgWorkspaceReaperRegistryAdapter } from './adapters/pg-workspace-reaper-registry.adapter.js';
import { PgWorkspaceRegistryAdapter } from './adapters/pg-workspace-registry.adapter.js';
import { AutosavePackager } from './autosave.packager.js';
import { AutosaveQueueProcessor } from './autosave-queue.processor.js';
import { GitDiffHelper } from './git-diff.helper.js';
import { PATCH_GENERATOR_PORT } from './ports/patch-generator.port.js';
import { SUBMISSION_REGISTRY_PORT } from './ports/submission-registry.port.js';
import {
  EmptyTerminalLogSource,
  TERMINAL_LOG_SOURCE_PORT,
} from './ports/terminal-log-source.port.js';
import {
  EmptyWorkspaceConfigSource,
  WORKSPACE_CONFIG_SOURCE_PORT,
} from './ports/workspace-config-source.port.js';
import {
  FailClosedWorkspaceDestroyer,
  WORKSPACE_DESTROYER_PORT,
} from './ports/workspace-destroyer.port.js';
import {
  FailClosedHeartbeatAdapter,
  WORKSPACE_HEARTBEAT_PORT,
} from './ports/workspace-heartbeat.port.js';
import {
  EmptyWorkspaceLifecycleAdapter,
  WORKSPACE_LIFECYCLE_PORT,
} from './ports/workspace-lifecycle.port.js';
import { NoOpWorkspaceNotifier, WORKSPACE_NOTIFIER_PORT } from './ports/workspace-notifier.port.js';
import { WORKSPACE_REAPER_REGISTRY_PORT } from './ports/workspace-reaper-registry.port.js';
import { WORKSPACE_REGISTRY_PORT } from './ports/workspace-registry.port.js';
import {
  AutosaveSnapshotAdapter,
  WORKSPACE_SNAPSHOT_PORT,
} from './ports/workspace-snapshot.port.js';
import {
  EmptyWorkspaceSourceAdapter,
  WORKSPACE_SOURCE_PORT,
} from './ports/workspace-source.port.js';
import {
  FailClosedWorkspaceVolumeReader,
  WORKSPACE_VOLUME_READER_PORT,
} from './ports/workspace-volume-reader.port.js';
import { SessionActivityService } from './session-activity.service.js';
import { SubmissionBundlerService } from './submission-bundler.service.js';
import { WorkspaceReaperScheduler } from './workspace-reaper.scheduler.js';
import { WorkspaceReaperService } from './workspace-reaper.service.js';

@Module({
  imports: [DatabaseModule, StorageModule, AuditModule],
  providers: [
    AutosavePackager,
    AutosaveQueueProcessor,
    SessionActivityService,
    PgWorkspaceRegistryAdapter,
    PgSubmissionRegistryAdapter,
    PgWorkspaceReaperRegistryAdapter,
    GitDiffHelper,
    SubmissionBundlerService,
    WorkspaceReaperService,
    WorkspaceReaperScheduler,
    {
      provide: WORKSPACE_REGISTRY_PORT,
      useClass: PgWorkspaceRegistryAdapter,
    },
    {
      provide: WORKSPACE_VOLUME_READER_PORT,
      useClass: FailClosedWorkspaceVolumeReader,
    },
    {
      provide: TERMINAL_LOG_SOURCE_PORT,
      useClass: EmptyTerminalLogSource,
    },
    {
      provide: WORKSPACE_CONFIG_SOURCE_PORT,
      useClass: EmptyWorkspaceConfigSource,
    },
    {
      provide: PATCH_GENERATOR_PORT,
      useClass: GitDiffHelper,
    },
    {
      provide: SUBMISSION_REGISTRY_PORT,
      useClass: PgSubmissionRegistryAdapter,
    },
    {
      provide: WORKSPACE_SOURCE_PORT,
      useClass: EmptyWorkspaceSourceAdapter,
    },
    {
      provide: WORKSPACE_LIFECYCLE_PORT,
      useClass: EmptyWorkspaceLifecycleAdapter,
    },
    {
      provide: WORKSPACE_REAPER_REGISTRY_PORT,
      useClass: PgWorkspaceReaperRegistryAdapter,
    },
    {
      provide: WORKSPACE_HEARTBEAT_PORT,
      useClass: FailClosedHeartbeatAdapter,
    },
    {
      provide: WORKSPACE_SNAPSHOT_PORT,
      useClass: AutosaveSnapshotAdapter,
    },
    {
      provide: WORKSPACE_DESTROYER_PORT,
      useClass: FailClosedWorkspaceDestroyer,
    },
    {
      provide: WORKSPACE_NOTIFIER_PORT,
      useClass: NoOpWorkspaceNotifier,
    },
  ],
  exports: [
    AutosavePackager,
    AutosaveQueueProcessor,
    SessionActivityService,
    SubmissionBundlerService,
    WorkspaceReaperService,
    WorkspaceReaperScheduler,
    GitDiffHelper,
    WORKSPACE_REGISTRY_PORT,
    WORKSPACE_VOLUME_READER_PORT,
    TERMINAL_LOG_SOURCE_PORT,
    WORKSPACE_CONFIG_SOURCE_PORT,
    PATCH_GENERATOR_PORT,
    SUBMISSION_REGISTRY_PORT,
    WORKSPACE_SOURCE_PORT,
    WORKSPACE_LIFECYCLE_PORT,
    WORKSPACE_REAPER_REGISTRY_PORT,
    WORKSPACE_HEARTBEAT_PORT,
    WORKSPACE_SNAPSHOT_PORT,
    WORKSPACE_DESTROYER_PORT,
    WORKSPACE_NOTIFIER_PORT,
  ],
})
export class WorkspacesModule {}
