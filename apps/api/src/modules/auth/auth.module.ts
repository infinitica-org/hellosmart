import { Module } from '@nestjs/common';
import { CryptoService } from '../../common/services/crypto.service.js';
import { MailService } from '../../common/services/mail.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { SessionsController } from './sessions.controller.js';
import { MfaEnrollmentController } from './mfa-enrollment.controller.js';
import { LoginLockoutService } from './login-lockout.service.js';
import { MfaService } from './mfa.service.js';
import { PasswordPolicyService } from './password-policy.service.js';
import { PreAuthService } from './pre-auth.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, InvitationsController, SessionsController, MfaEnrollmentController],
  providers: [
    AuthService,
    LoginLockoutService,
    PreAuthService,
    MfaService,
    CryptoService,
    InvitationsService,
    MailService,
    PasswordPolicyService,
  ],
  exports: [
    AuthService,
    MfaService,
    CryptoService,
    InvitationsService,
    MailService,
    PasswordPolicyService,
  ],
})
export class AuthModule {}
