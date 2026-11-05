/**
 * HelloSmart.ai — High-Contrast Professional Mailer HTML Generators
 *
 * Implements HelloSmart Brand Theme:
 * - Font Family: 'Google Sans Flex', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif
 * - Primary Brand Color: Vibrant HelloSmart Orange (#fe7330 / #ea580c / #c2410c)
 * - Contrast Accent: Midnight Navy & Deep Black (#0b1f3a / #0a0d12)
 * - Canvas & Surface: Crisp White (#ffffff), Subtle Surface (#f7f9fb), Clean Border (#e2e8f0)
 */

import { HELLOSMART_LOGO_BASE64 } from './brand-assets';

const FONT_STACK = "'Plus Jakarta Sans', 'Inter', 'Google Sans Flex', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const MONO_STACK = "'JetBrains Mono', 'SFMono-Regular', Consolas, Menlo, Monaco, monospace";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Standard Email Shell with embedded web font imports, modern typography, and responsive styling
 */
export function wrapInEmailHtml(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title)}</title>
  
  <!-- Embedded High-End SaaS Web Fonts (Plus Jakarta Sans, Inter, JetBrains Mono) -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

    body, table, td, p, a, div, h1, h2, h3, span {
      font-family: 'Plus Jakarta Sans', 'Inter', 'Google Sans Flex', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      letter-spacing: -0.011em;
    }

    h1, h2, h3, .font-heading {
      font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
      letter-spacing: -0.025em;
    }

    .font-mono {
      font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, Menlo, monospace !important;
      font-feature-settings: 'tnum' on, 'zero' on;
    }

    a {
      transition: all 0.15s ease;
    }

    /* Client-specific resets */
    table { border-collapse: separate; }
    a, body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  </style>

  <!--[if mso]>
  <style type="text/css">
    body, table, td, p, a, h1, h2, h3 { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: ${FONT_STACK}; -webkit-font-smoothing: antialiased; color: #1c2430;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f8; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px -2px rgba(11, 31, 58, 0.06); overflow: hidden; text-align: left;">
          ${bodyContent}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Reusable HelloSmart Brand Header with Official Logo & Typography
 */
function renderBrandHeader(brandName = 'HelloSmart.ai', tagline = 'Hire by doing', logoSrc?: string): string {
  const finalLogo = logoSrc ?? HELLOSMART_LOGO_BASE64;
  return `
    <tr>
      <td style="padding: 28px 36px 22px 36px; border-bottom: 1px solid #f1f5f9;">
        <table cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align: middle; padding-right: 14px;">
              <img src="${finalLogo}" width="40" height="40" alt="HelloSmart.ai" style="display: block; width: 40px; height: 40px; border-radius: 10px; border: 0; box-shadow: 0 2px 6px rgba(254, 115, 48, 0.25);" />
            </td>
            <td style="vertical-align: middle;">
              <div style="font-size: 20px; font-weight: 800; color: #0b1f3a; letter-spacing: -0.5px; line-height: 1.1;">
                HelloSmart<span style="color: #fe7330;">.ai</span>
              </div>
              <div style="font-size: 11px; font-weight: 600; color: #8a95a3; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 2px;">
                ${escapeHtml(tagline)}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

/**
 * 1. Candidate & Admin Assessment Invitation (Orange + Black + White)
 */
export function renderInvitationEmailHtml(params: {
  role: 'candidate' | 'company_admin';
  orgName: string;
  recipientEmail: string;
  inviteUrl: string;
  brandName?: string;
  expirationHours?: number;
}): string {
  const isCandidate = params.role === 'candidate';
  const roleName = isCandidate ? 'Candidate Assessment' : 'Company Administrator';
  const brandName = params.brandName ?? 'HelloSmart.ai';
  const expirationHours = params.expirationHours ?? 72;

  const headline = isCandidate
    ? `You're invited to complete an assessment for ${escapeHtml(params.orgName)}`
    : `You're invited to join ${escapeHtml(params.orgName)} on HelloSmart`;

  const description = isCandidate
    ? `<strong>${escapeHtml(params.orgName)}</strong> has invited you to complete a practical work simulation on HelloSmart.ai. You will work in a realistic workspace environment with AI tools to solve real challenges.`
    : `You have been invited to join <strong>${escapeHtml(params.orgName)}</strong> as a <strong>Company Administrator</strong> on HelloSmart.ai. You'll be able to create assessments, review candidate work, and manage rubrics.`;

  const buttonText = isCandidate
    ? 'Start Candidate Assessment &rarr;'
    : 'Activate Account &amp; Set Password &rarr;';

  const bodyContent = `
    ${renderBrandHeader(brandName)}

    <!-- Content -->
    <tr>
      <td style="padding: 32px 36px;">
        <!-- Pill Badge (Orange Tint) -->
        <div style="display: inline-block; padding: 4px 12px; font-size: 12px; font-weight: 700; color: #c2410c; background-color: #fff7ed; border: 1px solid #fed7aa; border-radius: 9999px; margin-bottom: 16px; letter-spacing: 0.2px;">
          ${escapeHtml(roleName)}
        </div>

        <h1 style="font-size: 23px; font-weight: 800; color: #0b1f3a; margin: 0 0 12px 0; line-height: 1.3; letter-spacing: -0.4px;">
          ${escapeHtml(headline)}
        </h1>

        <p style="font-size: 14px; line-height: 1.6; color: #3d4754; margin: 0 0 24px 0;">
          ${description}
        </p>

        <!-- Information Summary Box -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f7f9fb; border-radius: 12px; border: 1px solid #eef1f4; margin-bottom: 24px;">
          <tr>
            <td style="padding: 16px 20px; font-size: 13px; line-height: 1.8;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="color: #8a95a3; width: 120px;">Organization:</td>
                  <td style="color: #0b1f3a; font-weight: 700;">${escapeHtml(params.orgName)}</td>
                </tr>
                <tr>
                  <td style="color: #8a95a3;">Role:</td>
                  <td style="color: #0b1f3a; font-weight: 700;">${escapeHtml(roleName)}</td>
                </tr>
                <tr>
                  <td style="color: #8a95a3;">Recipient:</td>
                  <td style="color: #0b1f3a; font-weight: 600;">${escapeHtml(params.recipientEmail)}</td>
                </tr>
                <tr>
                  <td style="color: #8a95a3;">Link Security:</td>
                  <td style="color: #0b1f3a;">Single-use &bull; Expires in ${expirationHours} hours</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Primary HelloSmart Orange Button -->
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
          <tr>
            <td align="center" style="border-radius: 8px; background-color: #fe7330;">
              <a href="${params.inviteUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; background: linear-gradient(180deg, #fe7330 0%, #ea580c 100%); border: 1px solid #c2410c; box-shadow: 0 2px 6px rgba(254, 115, 48, 0.35); text-align: center;">
                ${buttonText}
              </a>
            </td>
          </tr>
        </table>

        <!-- Fallback Direct Link -->
        <div style="font-size: 12px; color: #5b6775; margin-bottom: 6px;">
          If the button does not work, copy and paste this link into your browser:
        </div>
        <div style="background-color: #f4f6f8; border: 1px solid #d8dee6; border-radius: 8px; padding: 10px 12px; font-size: 11px; color: #c2410c; word-break: break-all; font-family: ${MONO_STACK}; line-height: 1.4;">
          ${params.inviteUrl}
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 36px; background-color: #f7f9fb; border-top: 1px solid #eef1f4; font-size: 11px; line-height: 1.6; color: #8a95a3; text-align: center;">
        <p style="margin: 0 0 6px 0;">
          Single-use security link &bull; Valid for ${expirationHours} hours &bull; Do not forward
        </p>
        <p style="margin: 0; color: #94a3b8;">
          &copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}. All rights reserved. &bull; Hire by doing
        </p>
      </td>
    </tr>
  `;

  return wrapInEmailHtml(headline, bodyContent);
}
export function renderOtpEmailHtml(params: {
  code: string | number;
  recipientName?: string;
  expiresInMinutes?: number;
  brandName?: string;
}): string {
  const brandName = params.brandName ?? 'HelloSmart.ai';
  const name = params.recipientName ?? 'there';
  const expiresIn = params.expiresInMinutes ?? 10;
  const digits = String(params.code).trim().slice(0, 4).split('');

  const headline = 'Your HelloSmart verification code is ' + String(params.code);

  const bodyContent = `
    ${renderBrandHeader(brandName)}

    <!-- Content -->
    <tr>
      <td style="padding: 36px; text-align: center;">
        <h1 style="font-size: 23px; font-weight: 800; color: #0b1f3a; margin: 0 0 8px 0; letter-spacing: -0.4px;">
          Verification Code
        </h1>
        <p style="font-size: 14px; color: #5b6775; margin: 0 0 24px 0;">
          Hi ${escapeHtml(name)}, use this single-use code to complete your sign-in:
        </p>

        <!-- 4 Large Distinct Digit Boxes -->
        <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 24px auto;">
          <tr>
            ${digits
              .map(
                (d) => `
              <td style="padding: 0 6px;">
                <div style="width: 56px; height: 64px; line-height: 64px; text-align: center; font-size: 32px; font-weight: 800; font-family: ${MONO_STACK}; color: #fe7330; background-color: #ffffff; border: 2px solid #fed7aa; border-radius: 12px; box-shadow: 0 2px 8px rgba(254, 115, 48, 0.08);">
                  ${escapeHtml(d)}
                </div>
              </td>
            `
              )
              .join('')}
          </tr>
        </table>

        <p style="font-size: 12px; color: #8a95a3; margin: 0 0 24px 0;">
          This code expires in <strong style="color: #0b1f3a;">${expiresIn} minutes</strong>. Never share this code with anyone.
        </p>

        <!-- Solid Midnight Black Button with Orange Glow -->
        <table align="center" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto 24px auto;">
          <tr>
            <td align="center" style="border-radius: 8px; background-color: #0b1f3a;">
              <a href="http://localhost:3000/verify" style="display: inline-block; padding: 13px 26px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; background-color: #0b1f3a; box-shadow: 0 2px 6px rgba(11, 31, 58, 0.25);">
                Verify email address &rarr;
              </a>
            </td>
          </tr>
        </table>

        <p style="font-size: 11px; color: #94a3b8; margin: 0;">
          If you didn't request this verification code, you can safely ignore this email.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 36px; background-color: #f7f9fb; border-top: 1px solid #eef1f4; font-size: 11px; color: #94a3b8; text-align: center;">
        &copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}. All rights reserved. &bull; Secure Authentication
      </td>
    </tr>
  `;

  return wrapInEmailHtml(headline, bodyContent);
}

/**
 * 3. Announcement & Newsletter (Dark Hero Banner + Orange Accents)
 */
export function renderAnnouncementEmailHtml(params: {
  headline?: string;
  badgeText?: string;
  description?: string;
  brandName?: string;
  ctaText?: string;
  ctaHref?: string;
}): string {
  const brandName = params.brandName ?? 'HelloSmart.ai';
  const headline = params.headline ?? 'Hire with confidence through realistic work simulations';
  const badgeText = params.badgeText ?? 'ANNOUNCING OUR LATEST UPDATE';
  const description =
    params.description ??
    'We are proud to introduce a new generation of technical candidate evaluation tools built around controlled cloud workspaces, automated integrity monitoring, and independent rubric agents.';

  const bodyContent = `
    ${renderBrandHeader(brandName)}

    <!-- High-Contrast Midnight Black Hero Card with Orange Spark Accent -->
    <tr>
      <td style="padding: 24px 32px 0 32px;">
        <div style="background: linear-gradient(135deg, #0b1f3a 0%, #030a14 100%); border-radius: 14px; padding: 32px 24px; text-align: center; color: white; border: 1px solid #1a3a5c;">
          <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 10px; font-weight: 800; background: rgba(254, 115, 48, 0.15); border: 1px solid #fe7330; color: #fe7330; letter-spacing: 0.8px; margin-bottom: 12px; text-transform: uppercase;">
            ${escapeHtml(badgeText)}
          </div>
          <h2 style="font-size: 22px; font-weight: 800; margin: 0; color: #ffffff; letter-spacing: -0.4px; line-height: 1.3;">
            ${escapeHtml(headline)}
          </h2>
        </div>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 28px 32px; font-size: 14px; line-height: 1.6; color: #3d4754;">
        <p style="font-size: 15px; color: #1c2430; margin: 0 0 20px 0;">
          ${escapeHtml(description)}
        </p>

        <!-- Feature Cards -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 24px;">
          <tr>
            <td style="padding: 14px 18px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #f7f9fb; margin-bottom: 10px;">
              <div style="font-weight: 700; color: #0b1f3a; font-size: 13px;">
                Article: Designing fair technical rubrics for engineering teams &rarr;
              </div>
              <div style="font-size: 12px; color: #5b6775; margin-top: 3px;">
                Learn how leading companies define objective scoring signals that eliminate bias.
              </div>
            </td>
          </tr>
          <tr><td style="height: 10px;"></td></tr>
          <tr>
            <td style="padding: 14px 18px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #f7f9fb;">
              <div style="font-weight: 700; color: #0b1f3a; font-size: 13px;">
                Video Walkthrough: Candidate take-home workspace tour &rarr;
              </div>
              <div style="font-size: 12px; color: #5b6775; margin-top: 3px;">
                Take a 3-minute video tour of our browser IDE and AI tool integrations.
              </div>
            </td>
          </tr>
        </table>

        <!-- HelloSmart Orange CTA -->
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
          <tr>
            <td align="center" style="border-radius: 8px; background-color: #fe7330;">
              <a href="${params.ctaHref ?? 'https://hellosmart.ai/updates'}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 13px 26px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; background: linear-gradient(180deg, #fe7330 0%, #ea580c 100%); border: 1px solid #c2410c; box-shadow: 0 2px 6px rgba(254, 115, 48, 0.35);">
                ${escapeHtml(params.ctaText ?? 'Read the Full Release Notes')} &rarr;
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 32px; background-color: #f7f9fb; border-top: 1px solid #eef1f4; font-size: 11px; color: #8a95a3; text-align: center;">
        100 Main Street, Suite 500, San Francisco, CA &bull;
        <a href="https://hellosmart.ai/privacy" style="color: #fe7330; text-decoration: none;">Privacy Policy</a> &bull;
        &copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}
      </td>
    </tr>
  `;

  return wrapInEmailHtml(headline, bodyContent);
}

/**
 * 4. Personal Editorial Letter (Clean White Card + Orange Highlight Border)
 */
export function renderLetterEmailHtml(params: {
  recipientName?: string;
  senderName?: string;
  senderTitle?: string;
  brandName?: string;
  subject?: string;
}): string {
  const brandName = params.brandName ?? 'HelloSmart.ai';
  const name = params.recipientName ?? 'Sathesh';
  const sender = params.senderName ?? 'Sarah Jenkins';
  const senderTitle = params.senderTitle ?? 'Head of Engineering, HelloSmart.ai';
  const headline = params.subject ?? 'Personal note regarding your workspace environment';

  const bodyContent = `
    <!-- Header with Minimal Nav & Logo -->
    <tr>
      <td style="padding: 20px 36px; border-bottom: 1px solid #f1f5f9;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-right: 10px; vertical-align: middle;">
                    <img src="${HELLOSMART_LOGO_BASE64}" width="32" height="32" alt="HelloSmart" style="display: block; width: 32px; height: 32px; border-radius: 8px; border: 0;" />
                  </td>
                  <td style="vertical-align: middle; font-size: 18px; font-weight: 800; color: #0b1f3a; letter-spacing: -0.4px;">
                    HelloSmart<span style="color: #fe7330;">.ai</span>
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" style="font-size: 12px; color: #5b6775; vertical-align: middle;">
              <a href="https://hellosmart.ai" style="color: #5b6775; text-decoration: none; margin-left: 12px; font-weight: 500;">Home</a>
              <a href="https://hellosmart.ai/blog" style="color: #5b6775; text-decoration: none; margin-left: 12px; font-weight: 500;">Blog</a>
              <a href="https://hellosmart.ai/login" style="color: #5b6775; text-decoration: none; margin-left: 12px; font-weight: 500;">Account</a>
              <a href="https://hellosmart.ai/support" style="color: #5b6775; text-decoration: none; margin-left: 12px; font-weight: 500;">Support</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px 36px; font-size: 14px; line-height: 1.6; color: #3d4754;">
        <p style="font-size: 16px; font-weight: 700; color: #0b1f3a; margin: 0 0 16px 0;">
          Hi ${escapeHtml(name)},
        </p>

        <p style="margin: 0 0 16px 0;">
          Here is the latest update regarding your evaluation workspace environment and independent reviewer agents.
        </p>
        <p style="margin: 0 0 16px 0;">
          We have upgraded the evaluation workbench with deep code citations and automated test analysis:
        </p>

        <!-- Brand Orange Highlighted Border -->
        <table cellpadding="0" cellspacing="0" border="0" style="margin: 20px 0; border-left: 3px solid #fe7330; padding-left: 16px; background-color: #fffaf5; border-radius: 0 8px 8px 0; width: 100%;">
          <tr>
            <td style="padding: 12px 14px; font-size: 13px; color: #1c2430; line-height: 1.8;">
              <div><strong style="color: #c2410c;">&bull;</strong> Automated evidence aggregation across terminal history and git diffs</div>
              <div><strong style="color: #c2410c;">&bull;</strong> Real-time token and runtime spend guardrails with strict caps</div>
              <div><strong style="color: #c2410c;">&bull;</strong> Zero work loss architecture with 30-second continuous autosave</div>
            </td>
          </tr>
        </table>

        <!-- Orange CTA Button -->
        <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 16px 0;">
          <tr>
            <td align="center" style="border-radius: 8px; background-color: #fe7330;">
              <a href="https://hellosmart.ai" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 24px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; background: linear-gradient(180deg, #fe7330 0%, #ea580c 100%); border: 1px solid #c2410c; box-shadow: 0 2px 6px rgba(254, 115, 48, 0.35);">
                View Assessment Dashboard &rarr;
              </a>
            </td>
          </tr>
        </table>

        <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #5b6775;">
          <p style="margin: 0 0 4px 0;">Thanks,</p>
          <p style="margin: 0; font-weight: 700; color: #0b1f3a;">${escapeHtml(sender)}</p>
          <p style="margin: 2px 0 0 0; font-size: 11px; color: #8a95a3;">${escapeHtml(senderTitle)}</p>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 16px 36px; background-color: #f7f9fb; border-top: 1px solid #eef1f4; font-size: 11px; color: #8a95a3; text-align: center;">
        This email was sent to ${escapeHtml(name).toLowerCase()}@hellosmart.ai.
        <a href="https://hellosmart.ai/unsubscribe" style="color: #fe7330; text-decoration: underline;">Unsubscribe</a> &bull;
        &copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}. All rights reserved.
      </td>
    </tr>
  `;

  return wrapInEmailHtml(headline, bodyContent);
}

/**
 * 5. Feature Launch (Deep Midnight Black Banner with Vibrant Orange Glass Sheen)
 */
export function renderFeatureNotificationEmailHtml(params: {
  featureName?: string;
  description?: string;
  brandName?: string;
  ctaText?: string;
  ctaHref?: string;
}): string {
  const brandName = params.brandName ?? 'HelloSmart.ai';
  const feature = params.featureName ?? 'AI Rubric Agents 2.0';
  const desc =
    params.description ??
    'We have upgraded all evaluation rubrics with independent AI reviewer agents that automatically analyze commits, terminal sessions, and diffs with line-level evidence references.';
  const headline = `Introducing ${feature}`;

  const bodyContent = `
    ${renderBrandHeader(brandName)}

    <!-- Midnight Banner with HelloSmart Orange Light Glow -->
    <tr>
      <td style="padding: 24px 36px 0 36px;">
        <div style="background: linear-gradient(135deg, #0b1f3a 0%, #17110d 50%, #431407 100%); border-radius: 14px; padding: 32px 24px; text-align: center; color: #ffffff; border: 1px solid rgba(254, 115, 48, 0.3); box-shadow: 0 4px 20px rgba(254, 115, 48, 0.15);">
          <div style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: rgba(254, 115, 48, 0.2); border: 1px solid #fe7330; color: #fe7330; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
            NEW CAPABILITY
          </div>
          <h2 style="font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px; color: #ffffff;">
            ${escapeHtml(feature)}
          </h2>
        </div>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 28px 36px; font-size: 14px; line-height: 1.6; color: #3d4754;">
        <p style="font-size: 15px; color: #1c2430; margin: 0 0 16px 0;">
          ${escapeHtml(desc)}
        </p>

        <!-- Feature Points -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f7f9fb; border-radius: 12px; border: 1px solid #eef1f4; margin: 20px 0;">
          <tr>
            <td style="padding: 16px 20px; font-size: 13px; line-height: 1.8; color: #3d4754;">
              <strong style="color: #0b1f3a; display: block; margin-bottom: 6px;">Key Capabilities:</strong>
              <div><strong style="color: #fe7330;">&bull;</strong> Multi-agent rubric verification without evaluator bias</div>
              <div><strong style="color: #fe7330;">&bull;</strong> Verifiable citation tags linking to candidate code snippets</div>
              <div><strong style="color: #fe7330;">&bull;</strong> Automatic detection of reviewer score disagreement</div>
            </td>
          </tr>
        </table>

        <!-- HelloSmart Orange CTA -->
        <table cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 12px 0;">
          <tr>
            <td align="center" style="border-radius: 8px; background-color: #fe7330;">
              <a href="${params.ctaHref ?? 'https://hellosmart.ai/features'}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 13px 26px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 8px; background: linear-gradient(180deg, #fe7330 0%, #ea580c 100%); border: 1px solid #c2410c; box-shadow: 0 2px 6px rgba(254, 115, 48, 0.35);">
                ${escapeHtml(params.ctaText ?? 'Explore New Features')} &rarr;
              </a>
            </td>
          </tr>
        </table>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #5b6775;">
          <p style="margin: 0 0 4px 0;">Cheers,</p>
          <p style="margin: 0; font-weight: 700; color: #0b1f3a;">The ${escapeHtml(brandName)} Team</p>
        </div>
      </td>
    </tr>

    <!-- Footer with Preferences -->
    <tr>
      <td style="padding: 24px 36px; background-color: #f7f9fb; border-top: 1px solid #eef1f4; font-size: 11px; color: #8a95a3; text-align: center;">
        <p style="margin: 0 0 8px 0;">
          <a href="https://hellosmart.ai/preferences" style="color: #5b6775; text-decoration: underline;">Manage Preferences</a>
          &bull;
          <a href="https://hellosmart.ai/unsubscribe" style="color: #5b6775; text-decoration: underline;">Unsubscribe from all</a>
          &bull;
          <a href="https://hellosmart.ai/privacy" style="color: #5b6775; text-decoration: underline;">Privacy Policy</a>
        </p>
        <p style="margin: 0;">
          &copy; ${new Date().getFullYear()} ${escapeHtml(brandName)}. All rights reserved.
        </p>
      </td>
    </tr>
  `;

  return wrapInEmailHtml(headline, bodyContent);
}
