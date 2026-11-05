import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service.js';
import { AuditService } from './audit.service.js';
import { AuditInterceptor } from '../interceptors/audit.interceptor.js';
import { DatabaseModule } from '../database/database.module.js';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [AuditLogService, AuditService, AuditInterceptor],
  exports: [AuditLogService, AuditService, AuditInterceptor],
})
export class AuditModule {}
