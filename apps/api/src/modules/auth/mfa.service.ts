import { Inject, Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { APP_CONFIG } from '../../config/config.tokens.js';
import type { Config } from '../../config/config.js';
import { problem } from '../../common/errors/app-http.exception.js';

authenticator.options = { window: 1 };

@Injectable()
export class MfaService {
  constructor(@Inject(APP_CONFIG) private readonly config: Config) {}

  verifyTotp(secret: string, code: string): boolean {
    return authenticator.verify({ token: code, secret });
  }

  resolveSecret(mfaSecretRef: string | null): string {
    if (!mfaSecretRef) {
      throw problem({
        title: 'Unauthorized',
        status: 401,
        detail: 'MFA is not configured for this account',
        code: 'MFA_NOT_CONFIGURED',
      });
    }
    if (mfaSecretRef.startsWith('env:')) {
      const envKey = mfaSecretRef.slice('env:'.length);
      if (envKey === 'PLATFORM_ADMIN_MFA_SECRET' && this.config.PLATFORM_ADMIN_MFA_SECRET) {
        return this.config.PLATFORM_ADMIN_MFA_SECRET;
      }
    }
    throw problem({
      title: 'Unauthorized',
      status: 401,
      detail: 'MFA secret unavailable',
      code: 'MFA_NOT_CONFIGURED',
    });
  }
}
