import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { EmailSender } from '@hs/adapters';
import { type Config, loadConfig } from '../../config/config.js';
import { APP_CONFIG } from '../../config/config.tokens.js';

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
  DATABASE_URL: 'postgres://localhost:5432/hellosmart_test',
  DATABASE_MIGRATOR_URL: 'postgres://localhost:5432/hellosmart_test',
  SESSION_SECRET: 'test_session_secret_at_least_32_characters_long_hello',
  CORS_ORIGINS: ['http://localhost:3000'],
  PAYMENT_GATEWAY: 'fake',
  EMAIL_PROVIDER: 'fake',
  WORKSPACE_RUNTIME: 'fake',
  APP_BASE_URL: 'http://localhost:3000',
  MAILPIT_URL: 'http://127.0.0.1:8025',
};

@Injectable()
export class MailService implements EmailSender {
  private readonly logger = new Logger(MailService.name);
  private readonly config: Config;
  private lastInviteLink: string | null = null;

  constructor(@Optional() @Inject(APP_CONFIG) config?: Config) {
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

    return this.sendWithRealProvider(input);
  }

  /**
   * High-level method to send invitation links.
   * Must be called ONLY after the organization/invitation database transaction commits.
   */
  async sendInvitationEmail(input: SendInvitationInput): Promise<{ providerId: string; inviteUrl?: string }> {
    const inviteUrl = `${this.config.APP_BASE_URL}/accept-invite?token=${encodeURIComponent(input.token)}`;

    if (this.config.EMAIL_PROVIDER === 'fake') {
      this.lastInviteLink = inviteUrl;

      // S0-T08-3 requirement: Print the complete invite link only in development when
      // configured provider is fake/stub adapter for local manual testing.
      if (this.config.NODE_ENV === 'development') {
        this.logger.log(`[DEV INVITE LINK] ${inviteUrl}`);

        // Forward to local Mailpit inbox on 127.0.0.1:8025 if reachable.
        // Await delivery so the invitation is visible in Mailpit before this method returns.
        const mailpitUrl = this.config.MAILPIT_URL ?? 'http://127.0.0.1:8025';
        try {
          const response = await fetch(`${mailpitUrl}/api/v1/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              From: { Email: 'no-reply@hellosmart.ai', Name: 'HelloSmart.ai Notification' },
              To: [{ Email: input.to }],
              Subject: `You have been invited to join ${input.orgName} on HelloSmart.ai`,
              HTML: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 36px 20px;">
                  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
                    <div style="margin-bottom: 20px;">
                      <span style="font-size: 20px; font-weight: 900; color: #0f172a;">HelloSmart<span style="color: #4f46e5;">.ai</span></span>
                    </div>
                    <h1 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">You're Invited to ${input.orgName}</h1>
                    <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                      You have been invited to join <strong>${input.orgName}</strong> on HelloSmart.ai as a <strong>${input.role}</strong>.
                    </p>
                    <div style="margin: 28px 0;">
                      <a href="${inviteUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px;">
                        Activate Account &amp; Set Password &rarr;
                      </a>
                    </div>
                    <p style="font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                      This link is single-use and expires in 72 hours.
                    </p>
                  </div>
                </div>
              `,
              Text: `Welcome to ${input.orgName}! Activate your account: ${inviteUrl}`,
            }),
            signal: AbortSignal.timeout(3_000),
          });
          if (!response.ok) {
            this.logger.warn(`[Mailpit] Invitation email was not captured (HTTP ${response.status}); ensure Mailpit is running at ${mailpitUrl}`);
          }
        } catch (err) {
          // Keep local invitation creation usable when Mailpit is not running.
          this.logger.warn(`[Mailpit] Could not capture invitation email (${(err as Error).message}); ensure Mailpit is running at ${mailpitUrl}`);
        }
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
    throw new Error('Real email provider (SES) is not yet configured on this instance');
  }
}
