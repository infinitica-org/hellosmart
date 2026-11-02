import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { AuditModule } from '../audit/audit.module.js';
import { ASSIGNMENT_OWNERSHIP_PORT, STORAGE_CONFIG, STORAGE_PORT } from './storage.tokens.js';
import { type StorageConfig, type StoragePort } from './storage.types.js';
import { LocalFsStorageAdapter } from './local-fs-storage.adapter.js';
import { S3StorageAdapter } from './s3-storage.adapter.js';
import { FakeStorageAdapter } from './fake-storage.adapter.js';
import { FailClosedAssignmentOwnershipAdapter } from './assignment-ownership.port.js';
import { StorageService } from './storage.service.js';
import { StorageController } from './storage.controller.js';

@Module({
  imports: [AuditModule],
  controllers: [StorageController],
  providers: [
    StorageService,
    {
      provide: STORAGE_CONFIG,
      useFactory: (appConfig: Config): StorageConfig => {
        return {
          driver: appConfig.STORAGE_DRIVER as any,
          localRoot: appConfig.STORAGE_LOCAL_ROOT,
          signingSecret: appConfig.STORAGE_SIGNING_SECRET || appConfig.SESSION_SECRET,
          bucket: appConfig.STORAGE_S3_BUCKET || 'hs-local-artifacts',
          region: appConfig.STORAGE_S3_REGION || 'us-east-1',
          endpoint: appConfig.STORAGE_S3_ENDPOINT,
        };
      },
      inject: [APP_CONFIG],
    },
    {
      provide: STORAGE_PORT,
      useFactory: (config: StorageConfig): StoragePort => {
        if (config.driver === 's3') {
          return new S3StorageAdapter(config);
        }
        if (config.driver === 'fake') {
          return new FakeStorageAdapter();
        }
        return new LocalFsStorageAdapter(config);
      },
      inject: [STORAGE_CONFIG],
    },
    {
      provide: ASSIGNMENT_OWNERSHIP_PORT,
      useFactory: () => {
        // Default fail-closed adapter until Stream 2 migrations provide app.assignments
        return new FailClosedAssignmentOwnershipAdapter();
      },
    },
  ],
  exports: [StorageService, STORAGE_PORT, ASSIGNMENT_OWNERSHIP_PORT, STORAGE_CONFIG],
})
export class StorageModule {}
