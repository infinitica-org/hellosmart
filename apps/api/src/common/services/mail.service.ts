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

export interface SendAssessmentInvitationInput {
  to: string;
  token: string;
  orgName: string;
  orgId: string;
  assessmentId: string;
  assessmentName: string;
}

export const DEFAULT_MAIL_CONFIG: Config = {
  NODE_ENV: 'test',
  PORT: 4000,
  LOG_LEVEL: 'info',
  DATABASE_URL: 'postgres://localhost:5432/hellosmart_test',
  DATABASE_MIGRATOR_URL: 'postgres://localhost:5432/hellosmart_test',
  DATABASE_PLATFORM_URL: 'postgres://localhost:5432/hellosmart_test',
  SESSION_SECRET: 'test_session_secret_at_least_32_characters_long_hello',
  CORS_ORIGINS: ['http://localhost:3000'],
  PAYMENT_GATEWAY: 'fake',
  EMAIL_PROVIDER: 'fake',
  WORKSPACE_RUNTIME: 'fake',
  APP_BASE_URL: 'http://localhost:3000',
  MAILPIT_URL: 'http://127.0.0.1:8025',
  HIBP_FAIL_OPEN: true,
  MFA_ENCRYPTION_KEY_ID: 'k1',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_ROOT: '.storage',
  STORAGE_S3_BUCKET: 'hs-local-artifacts',
  STORAGE_S3_REGION: 'us-east-1',
  RETENTION_PURGE_ENABLED: false,
  RETENTION_PURGE_HOUR_UTC: 3,
  RETENTION_PURGE_BATCH_SIZE: 100,
  RETENTION_PURGE_DRY_RUN: false,
  WORKSPACE_AUTOSAVE_ENABLED: false,
  AUTOSAVE_INTERVAL_SECONDS: 30,
  INTERNATIONAL_TAX_TREATMENT: 'reject',
  PG_POOL_MAX: 5,
  PG_CONNECTION_TIMEOUT_MS: 5_000,
  OTEL_SERVICE_NAME: 'hellosmart-api',
  WORKER_HEALTH_PORT: 4001,
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function buildInvitationEmailHtml(input: SendInvitationInput, inviteUrl: string): string {
  const isCandidate = input.role === 'candidate';
  const roleName = isCandidate ? 'Candidate' : 'Company Administrator';
  const roleBadgeBg = isCandidate ? '#fff7ed' : '#f0fdf4';
  const roleBadgeText = isCandidate ? '#c2410c' : '#15803d';
  const roleBadgeBorder = isCandidate ? '#fed7aa' : '#bbf7d0';

  const headline = isCandidate
    ? `You're invited to complete an assessment for ${escapeHtml(input.orgName)}`
    : `You're invited to join ${escapeHtml(input.orgName)} on HelloSmart`;

  const description = isCandidate
    ? `<strong>${escapeHtml(input.orgName)}</strong> has invited you to complete a practical work simulation on HelloSmart.ai. You will work in a realistic workspace environment with AI tools to solve real challenges.`
    : `You have been invited to join <strong>${escapeHtml(input.orgName)}</strong> as a <strong>Company Administrator</strong> on HelloSmart.ai. You'll be able to create assessments, review candidate work, and manage your team's rubrics.`;

  const buttonText = isCandidate
    ? 'Start Candidate Assessment &rarr;'
    : 'Activate Account &amp; Set Password &rarr;';

  const subtitle = isCandidate
    ? 'Practical Work Simulation &bull; Controlled Workspace'
    : 'Company Portal &bull; Assessment Platform';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(headline)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1c2430;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f8; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #d8dee6; box-shadow: 0 4px 12px rgba(11, 31, 58, 0.05); overflow: hidden; text-align: left;">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 32px 36px 24px 36px; border-bottom: 1px solid #f1f5f9;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align: middle; padding-right: 12px;">
                    <!-- HelloSmart Logo Mark -->
                    <div style="width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #fe7330 0%, #ea580c 100%); text-align: center; line-height: 40px; box-shadow: 0 2px 6px rgba(254, 115, 48, 0.3);">
                      <span style="font-size: 20px; color: #ffffff; font-weight: bold; line-height: 40px; display: inline-block;">✦</span>
                    </div>
                  </td>
                  <td style="vertical-align: middle;">
                    <div style="font-size: 22px; font-weight: 800; color: #0b1f3a; letter-spacing: -0.5px; line-height: 1.2;">
                      HelloSmart<span style="color: #fe7330;">.ai</span>
                    </div>
                    <div style="font-size: 11px; font-weight: 600; color: #8a95a3; letter-spacing: 0.5px; text-transform: uppercase;">
                      Hire by doing
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Body Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <!-- Role Badge -->
              <div style="display: inline-block; padding: 4px 12px; font-size: 12px; font-weight: 600; color: ${roleBadgeText}; background-color: ${roleBadgeBg}; border: 1px solid ${roleBadgeBorder}; border-radius: 9999px; margin-bottom: 16px;">
                ${escapeHtml(roleName)}
              </div>

              <!-- Headline -->
              <h1 style="font-size: 22px; font-weight: 700; color: #0b1f3a; margin: 0 0 12px 0; line-height: 1.3; letter-spacing: -0.3px;">
                ${escapeHtml(headline)}
              </h1>

              <!-- Subtitle / Meta -->
              <div style="font-size: 13px; color: #8a95a3; margin-bottom: 20px; font-weight: 500;">
                ${subtitle}
              </div>

              <!-- Description Paragraph -->
              <p style="font-size: 14px; line-height: 1.6; color: #3d4754; margin: 0 0 24px 0;">
                ${description}
              </p>

              <!-- Metadata Summary Box -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f7f9fb; border-radius: 12px; border: 1px solid #eef1f4; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size: 13px; line-height: 1.8;">
                      <tr>
                        <td style="color: #8a95a3; width: 120px; padding: 2px 0;">Organization:</td>
                        <td style="color: #0b1f3a; font-weight: 600; padding: 2px 0;">${escapeHtml(input.orgName)}</td>
                      </tr>
                      <tr>
                        <td style="color: #8a95a3; padding: 2px 0;">Assigned Role:</td>
                        <td style="color: #0b1f3a; font-weight: 600; padding: 2px 0;">${escapeHtml(roleName)}</td>
                      </tr>
                      <tr>
                        <td style="color: #8a95a3; padding: 2px 0;">Recipient:</td>
                        <td style="color: #0b1f3a; font-weight: 600; padding: 2px 0;">${escapeHtml(input.to)}</td>
                      </tr>
                      <tr>
                        <td style="color: #8a95a3; padding: 2px 0;">Link Security:</td>
                        <td style="color: #0b1f3a; font-weight: 500; padding: 2px 0;">Single-use &bull; Expires in 72 hours</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Primary Call To Action Button -->
              <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #fe7330;">
                    <a href="${inviteUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px; background: linear-gradient(180deg, #fe7330 0%, #ea580c 100%); box-shadow: 0 4px 10px rgba(254, 115, 48, 0.35); text-align: center; border: 1px solid #c2410c;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Fallback Direct URL Box -->
              <div style="font-size: 12px; color: #5b6775; margin-bottom: 8px;">
                If the button above does not work, copy and paste this link into your browser:
              </div>
              <div style="background-color: #f4f6f8; border: 1px solid #d8dee6; border-radius: 8px; padding: 12px; font-size: 12px; color: #1b6bba; word-break: break-all; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; line-height: 1.4;">
                ${inviteUrl}
              </div>
            </td>
          </tr>

          <!-- Security Notice & Legal Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #f7f9fb; border-top: 1px solid #eef1f4; font-size: 12px; line-height: 1.6; color: #8a95a3;">
              <p style="margin: 0 0 8px 0;">
                <strong style="color: #5b6775;">Security Note:</strong> This invitation is single-use and valid for 72 hours. Do not forward or share this link. On first sign-in, you will be prompted to set a secure password.
              </p>
              <p style="margin: 0 0 16px 0;">
                If you were not expecting this invitation from ${escapeHtml(input.orgName)}, you can safely ignore this email.
              </p>
              <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8;">
                &copy; ${new Date().getFullYear()} HelloSmart.ai. All rights reserved. &bull; Hire by doing
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function buildInvitationEmailText(input: SendInvitationInput, inviteUrl: string): string {
  const isCandidate = input.role === 'candidate';
  const roleName = isCandidate ? 'Candidate' : 'Company Administrator';

  return `
HelloSmart.ai — Hire by doing
=========================================

You're invited to join ${input.orgName}

${
  isCandidate
    ? `${input.orgName} has invited you to complete a practical work simulation on HelloSmart.ai.`
    : `You have been invited to join ${input.orgName} on HelloSmart.ai as a Company Administrator.`
}

Invitation Details:
• Organization: ${input.orgName}
• Role: ${roleName}
• Recipient: ${input.to}
• Expiration: 72 hours (Single-use)

Activate your account and get started by visiting:
${inviteUrl}

Note: For your security, this invitation is single-use and expires in 72 hours.
If you were not expecting this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} HelloSmart.ai. All rights reserved.
  `.trim();
}

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
        this.logger.debug(
          `[FakeMail] Template: ${input.template} To: ${input.to} Vars: ${JSON.stringify(input.vars)}`,
        );
      }
      return { providerId };
    }

    return this.sendWithRealProvider(input);
  }

  /**
   * High-level method to send invitation links.
   * Must be called ONLY after the organization/invitation database transaction commits.
   */
  async sendInvitationEmail(
    input: SendInvitationInput,
  ): Promise<{ providerId: string; inviteUrl?: string }> {
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
          const subject =
            input.role === 'candidate'
              ? `You have been invited to complete an assessment for ${input.orgName} on HelloSmart.ai`
              : `You have been invited to join ${input.orgName} on HelloSmart.ai`;

          const response = await fetch(`${mailpitUrl}/api/v1/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              From: { Email: 'no-reply@hellosmart.ai', Name: 'HelloSmart.ai' },
              To: [{ Email: input.to }],
              Subject: subject,
              HTML: buildInvitationEmailHtml(input, inviteUrl),
              Text: buildInvitationEmailText(input, inviteUrl),
            }),
            signal: AbortSignal.timeout(3_000),
          });
          if (!response.ok) {
            this.logger.warn(
              `[Mailpit] Invitation email was not captured (HTTP ${response.status}); ensure Mailpit is running at ${mailpitUrl}`,
            );
          }
        } catch (err) {
          // Keep local invitation creation usable when Mailpit is not running.
          this.logger.warn(
            `[Mailpit] Could not capture invitation email (${(err as Error).message}); ensure Mailpit is running at ${mailpitUrl}`,
          );
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
   * Dispatches assessment invitation emails for candidate assignments (S1-T05-1).
   * Separate from account creation onboarding; links directly to assessment workspace with 7-day expiry.
   */
  async sendAssessmentInvitationEmail(
    input: SendAssessmentInvitationInput,
  ): Promise<{ providerId: string; inviteUrl?: string }> {
    const inviteUrl = `${this.config.APP_BASE_URL}/candidate/assessments/${encodeURIComponent(input.assessmentId)}?token=${encodeURIComponent(input.token)}`;

    if (this.config.EMAIL_PROVIDER === 'fake') {
      this.lastInviteLink = inviteUrl;

      if (this.config.NODE_ENV === 'development') {
        this.logger.log(`[DEV ASSESSMENT INVITE] Dispatched invitation to ${input.to} for assessment ${input.assessmentId}`);

        const mailpitUrl = this.config.MAILPIT_URL ?? 'http://127.0.0.1:8025';
        try {
          const response = await fetch(`${mailpitUrl}/api/v1/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              From: { Email: 'no-reply@hellosmart.ai', Name: 'HelloSmart.ai Notification' },
              To: [{ Email: input.to }],
              Subject: `Assessment Invitation: ${input.assessmentName} at ${input.orgName}`,
              HTML: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 36px 20px;">
                  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0;">
                    <div style="margin-bottom: 20px;">
                      <span style="font-size: 20px; font-weight: 900; color: #0f172a;">HelloSmart<span style="color: #4f46e5;">.ai</span></span>
                    </div>
                    <h1 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">You're Invited to Complete an Assessment</h1>
                    <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                      You have been assigned to complete <strong>${input.assessmentName}</strong> for <strong>${input.orgName}</strong> on HelloSmart.ai.
                    </p>
                    <div style="margin: 28px 0;">
                      <a href="${inviteUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px;">
                        Start Assessment &rarr;
                      </a>
                    </div>
                    <p style="font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px;">
                      This assessment link is single-use and expires in 7 days.
                    </p>
                  </div>
                </div>
              `,
              Text: `You have been assigned to ${input.assessmentName} at ${input.orgName}. Access your assessment: ${inviteUrl}`,
            }),
            signal: AbortSignal.timeout(3_000),
          });
          if (!response.ok) {
            this.logger.warn(`[Mailpit] Assessment invitation email was not captured (HTTP ${response.status})`);
          }
        } catch (err) {
          this.logger.warn(`[Mailpit] Could not capture assessment invitation email (${(err as Error).message})`);
        }
      }

      return {
        providerId: `fake_assessment_invite_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        inviteUrl,
      };
    }

    const result = await this.send({
      to: input.to,
      template: 'assessment_invitation',
      vars: {
        inviteUrl,
        assessmentName: input.assessmentName,
        orgName: input.orgName,
      },
      orgId: input.orgId,
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
