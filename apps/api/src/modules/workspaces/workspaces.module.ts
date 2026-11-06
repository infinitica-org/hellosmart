import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PgWorkspaceRegistryAdapter } from './adapters/pg-workspace-registry.adapter.js';
import { AutosavePackager } from './autosave.packager.js';
import { AutosaveQueueProcessor } from './autosave-queue.processor.js';
import {
  EmptyTerminalLogSource,
  TERMINAL_LOG_SOURCE_PORT,
} from './ports/terminal-log-source.port.js';
import {
  EmptyWorkspaceConfigSource,
  WORKSPACE_CONFIG_SOURCE_PORT,
} from './ports/workspace-config-source.port.js';
import { WORKSPACE_REGISTRY_PORT } from './ports/workspace-registry.port.js';
import {
  FailClosedWorkspaceVolumeReader,
  WORKSPACE_VOLUME_READER_PORT,
} from './ports/workspace-volume-reader.port.js';
import { SessionActivityService } from './session-activity.service.js';

@Module({
  imports: [DatabaseModule, StorageModule],
  providers: [
    AutosavePackager,
    AutosaveQueueProcessor,
    SessionActivityService,
    PgWorkspaceRegistryAdapter,
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
  ],
  exports: [
    AutosavePackager,
    AutosaveQueueProcessor,
    SessionActivityService,
    WORKSPACE_REGISTRY_PORT,
    WORKSPACE_VOLUME_READER_PORT,
    TERMINAL_LOG_SOURCE_PORT,
    WORKSPACE_CONFIG_SOURCE_PORT,
  ],
})
export class WorkspacesModule {}
