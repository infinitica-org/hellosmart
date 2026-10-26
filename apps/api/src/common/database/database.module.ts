import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { TenantContextService } from './tenant-context.service.js';

@Global()
@Module({
  providers: [DatabaseService, TenantContextService],
  exports: [DatabaseService, TenantContextService],
})
export class DatabaseModule {}

