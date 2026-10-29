import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service.js';
import { DatabaseModule } from '../database/database.module.js';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditModule {}
