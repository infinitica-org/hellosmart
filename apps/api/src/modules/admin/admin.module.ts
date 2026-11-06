import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminMetricsController } from './admin-metrics.controller.js';
import { AdminOrganizationsController } from './admin-organizations.controller.js';
import { AdminOrganizationsService } from './admin-organizations.service.js';
import { AdminAuditController } from './admin-audit.controller.js';
import { AdminAuditService } from './admin-audit.service.js';
import { AdminAiKeysController } from './admin-ai-keys.controller.js';
import { AdminAiKeysService } from './admin-ai-keys.service.js';
import { CryptoService } from '../../common/services/crypto.service.js';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminOrganizationsController,
    AdminMetricsController,
    AdminAuditController,
    AdminAiKeysController,
  ],
  providers: [
    AdminOrganizationsService,
    AdminAuditService,
    AdminAiKeysService,
    CryptoService,
  ],
})
export class AdminModule {}
