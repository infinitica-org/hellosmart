import { Module } from '@nestjs/common';
import { CryptoService } from '../../common/services/crypto.service.js';
import { MailService } from '../../common/services/mail.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { LoginLockoutService } from './login-lockout.service.js';
import { MfaService } from './mfa.service.js';
import { PreAuthService } from './pre-auth.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, InvitationsController],
  providers: [
    AuthService,
    LoginLockoutService,
    PreAuthService,
    MfaService,
    CryptoService,
    InvitationsService,
    MailService,
  ],
  exports: [AuthService, MfaService, CryptoService, InvitationsService, MailService],
})
export class AuthModule {}
