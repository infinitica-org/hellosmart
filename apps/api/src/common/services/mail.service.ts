import { Injectable, Logger, Optional } from '@nestjs/common';
import type { EmailSender } from '@hs/adapters';
import { type Config, loadConfig } from '../../config/config.js';

export interface SendInvitationInput {
  to: string;
  token: string;
  role: 'company_admin' | 'candidate';
  orgName: string;
  orgId?: string;
}

export const DEFAULT_MAIL_CONFIG: Config = {
  NODE_ENV: 'test',
  PORT: 4000,
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://localhost:5432/hellosmart_test',
  REDIS_URL: 'redis://localhost:6379',
  SESSION_SECRET: 'test_session_secret_at_least_32_characters_long_hello',
  CORS_ORIGINS: ['http://localhost:3000'],
  PAYMENT_GATEWAY: 'fake',
  EMAIL_PROVIDER: 'fake',
  WORKSPACE_RUNTIME: 'fake',
  APP_BASE_URL: 'http://localhost:3000',
};

@Injectable()
export class MailService implements EmailSender {
  private readonly logger = new Logger(MailService.name);
  private readonly config: Config;
  private lastInviteLink: string | null = null;

  constructor(@Optional() config?: Config) {
    if (config) {
      this.config = config;
    } else {
      try {
        this.config = loadConfig();
      } catch {
        this.config = DEFAULT_MAIL_CONFIG;
      }
    }

    if (this.config.NODE_ENV === 'production' && this.config.EMAIL_PROVIDER === 'fake') {
      throw new Error('Fake mail provider is not allowed in production');
    }
  }

  /**
   * Implements @hs/adapters EmailSender interface.
   */
  async send(input: {
    to: string;
    template: string;
    vars: Record<string, string>;
    orgId?: string;
  }): Promise<{ providerId: string }> {
    if (this.config.EMAIL_PROVIDER === 'fake') {
      const providerId = `fake_mail_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      if (this.config.NODE_ENV === 'development' || this.config.NODE_ENV === 'test') {
        this.logger.debug(`[FakeMail] Template: ${input.template} To: ${input.to} Vars: ${JSON.stringify(input.vars)}`);
      }
      return { providerId };
    }

    // Real email provider adapter hook (e.g. AWS SES with SPF/DKIM configured identities)
    // When implementing SES: verify verified identities, DKIM signing, and bounce notifications
    return this.sendWithRealProvider(input);
  }

  /**
   * High-level method to send invitation links.
   * Must be called ONLY after the organization/invitation database transaction commits.
   */
  async sendInvitationEmail(input: SendInvitationInput): Promise<{ providerId: string; inviteUrl?: string }> {
    const inviteUrl = `${this.config.APP_BASE_URL}/set-password?token=${encodeURIComponent(input.token)}`;

    if (this.config.EMAIL_PROVIDER === 'fake') {
      this.lastInviteLink = inviteUrl;

      // S0-T08-3 requirement: Print the complete invite link only in development when
      // configured provider is fake/stub adapter for local manual testing.
      if (this.config.NODE_ENV === 'development') {
        this.logger.log(`[DEV INVITE LINK] ${inviteUrl}`);
      }

      return {
        providerId: `fake_invite_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        inviteUrl,
      };
    }

    // Production email dispatch via template
    const result = await this.send({
      to: input.to,
      template: 'invitation',
      vars: {
        inviteUrl,
        role: input.role,
        orgName: input.orgName,
      },
      ...(input.orgId ? { orgId: input.orgId } : {}),
    });

    return {
      providerId: result.providerId,
    };
  }

  /**
   * Returns the last generated invite link for test assertions.
   * Available in-memory without persistent secret exposure.
   */
  getLastInviteLink(): string | null {
    return this.lastInviteLink;
  }

  /**
   * Clears in-memory test link state.
   */
  clearLastInviteLink(): void {
    this.lastInviteLink = null;
  }

  private async sendWithRealProvider(_input: {
    to: string;
    template: string;
    vars: Record<string, string>;
    orgId?: string;
  }): Promise<{ providerId: string }> {
    // Adapter hook for AWS SES or SMTP with SPF/DKIM verification (BR-34)
    throw new Error('Real email provider (SES) is not yet configured on this instance');
  }
}
