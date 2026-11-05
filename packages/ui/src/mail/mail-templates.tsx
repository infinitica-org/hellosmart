import React from 'react';
import { EmailCard } from './mail-card';
import { EmailHeader, EmailHeaderVariant } from './mail-header';
import { EmailFooter, EmailFooterVariant } from './mail-footer';
import { EmailOtpCode } from './mail-otp-code';
import { EmailHero, EmailHeroVariant } from './mail-hero';
import { EmailButton } from './mail-button';

// ─────────────────────────────────────────────────────────────────────────────
// 1. Email Letter Template (Personal / Editorial) - HelloSmart Theme
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailLetterTemplateProps {
  recipientName?: string;
  senderName?: string;
  senderTitle?: string;
  brandName?: string;
  subject?: string;
  paragraphs?: string[];
  bulletPoints?: string[];
  ctaText?: string;
  ctaHref?: string;
  headerVariant?: EmailHeaderVariant;
  footerVariant?: EmailFooterVariant;
}

export function EmailLetterTemplate({
  recipientName = 'Sathesh',
  senderName = 'Sarah Jenkins',
  senderTitle = 'Head of Engineering, HelloSmart.ai',
  brandName = 'HelloSmart.ai',
  subject = 'Personal note regarding your workspace environment',
  paragraphs = [
    'Here is the latest update regarding your evaluation workspace environment and independent reviewer agents.',
    'We have made several major enhancements to the evaluation workbench, giving you full control over independent reviewer agents, rubric citations, and live session replays.',
  ],
  bulletPoints = [
    'Automated evidence aggregation across terminal history and git diffs',
    'Real-time token and runtime spend guardrails with strict caps',
    'Zero work loss architecture with 30-second continuous autosave',
  ],
  ctaText = 'View Assessment Dashboard',
  ctaHref = 'https://hellosmart.ai',
  headerVariant = 'with-nav',
  footerVariant = 'minimal',
}: EmailLetterTemplateProps) {
  return (
    <EmailCard subject={subject} showClientChrome={false}>
      <EmailHeader variant={headerVariant} brandName={brandName} />

      <div className="p-8 space-y-6 text-sm text-neutral-700 leading-relaxed font-sans">
        <p className="text-base font-bold text-[#0b1f3a]">
          Hi {recipientName},
        </p>

        {paragraphs.map((p, idx) => (
          <p key={idx}>{p}</p>
        ))}

        {bulletPoints && bulletPoints.length > 0 && (
          <ul className="space-y-2.5 my-4 pl-4 border-l-3 border-[#fe7330] bg-[#fffaf5] p-3 rounded-r-lg">
            {bulletPoints.map((bp, idx) => (
              <li key={idx} className="flex items-start gap-2 text-neutral-800 text-xs">
                <span className="text-[#fe7330] font-bold">•</span>
                <span>{bp}</span>
              </li>
            ))}
          </ul>
        )}

        {ctaText && ctaHref && (
          <div className="pt-2">
            <EmailButton href={ctaHref} variant="orange" showArrow>
              {ctaText}
            </EmailButton>
          </div>
        )}

        <div className="pt-4 border-t border-neutral-100 text-neutral-600">
          <p>Thanks,</p>
          <p className="font-bold text-[#0b1f3a]">{senderName}</p>
          {senderTitle && <p className="text-xs text-neutral-400">{senderTitle}</p>}
        </div>
      </div>

      <EmailFooter variant={footerVariant} brandName={brandName} />
    </EmailCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Email Announcement Template (Newsletter & Releases) - HelloSmart Theme
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailArticleLink {
  title: string;
  description: string;
  href: string;
  tag?: string;
}

export interface EmailAnnouncementTemplateProps {
  badgeText?: string;
  headline?: string;
  description?: string;
  heroImageSrc?: string;
  heroVariant?: EmailHeroVariant;
  articles?: EmailArticleLink[];
  quote?: string;
  ctaText?: string;
  ctaHref?: string;
  brandName?: string;
}

export function EmailAnnouncementTemplate({
  badgeText = 'ANNOUNCING OUR LATEST UPDATE',
  headline = 'Hire with confidence through realistic work simulations',
  description = 'We are proud to introduce a new generation of technical candidate evaluation tools built around controlled cloud workspaces, automated integrity monitoring, and independent rubric agents.',
  heroVariant = 'gradient',
  heroImageSrc,
  articles = [
    {
      title: 'Article: Designing fair technical rubrics for modern teams',
      description: 'Learn how leading tech orgs define objective scoring signals that eliminate bias.',
      href: 'https://hellosmart.ai/blog/fair-rubrics',
      tag: 'Guide',
    },
    {
      title: 'Video walkthrough: Inside the candidate take-home workspace',
      description: 'Take a 3-minute tour of our distraction-free browser IDE and AI tool integrations.',
      href: 'https://hellosmart.ai/video/workspace-tour',
      tag: 'Tutorial',
    },
    {
      title: 'Documentation: AI Proxy and token cap enforcement',
      description: 'Read the architectural guide on per-session spend limits and egress controls.',
      href: 'https://hellosmart.ai/docs/proxy',
      tag: 'Docs',
    },
  ],
  ctaText = 'Read the Full Release Notes',
  ctaHref = 'https://hellosmart.ai/updates',
  brandName = 'HelloSmart.ai',
}: EmailAnnouncementTemplateProps) {
  return (
    <EmailCard>
      <EmailHeader variant="simple" brandName={brandName} />

      <div className="p-8">
        {/* High-Contrast Hero Banner */}
        <div className="w-full rounded-xl overflow-hidden border border-[#1a3a5c] mb-6 bg-gradient-to-br from-[#0b1f3a] to-[#030a14] p-6 text-center text-white">
          <span className="inline-block px-3 py-1 rounded-full text-[10px] font-extrabold bg-[#fe7330]/20 border border-[#fe7330] text-[#fe7330] tracking-wider uppercase mb-2">
            {badgeText}
          </span>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            {headline}
          </h2>
        </div>

        <div className="space-y-6 text-sm text-neutral-700 leading-relaxed">
          <p className="text-base text-neutral-600">
            {description}
          </p>

          {/* Featured Articles / Links */}
          {articles && articles.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Featured Highlights
              </h3>
              <div className="space-y-2.5">
                {articles.map((art, idx) => (
                  <a
                    key={idx}
                    href={art.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 rounded-xl border border-neutral-200/90 hover:border-[#fe7330] hover:bg-neutral-50/50 transition-all text-neutral-900 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm group-hover:text-[#fe7330] transition-colors">
                        {art.title}
                      </span>
                      <span className="text-neutral-400 group-hover:translate-x-0.5 transition-transform">
                        &rarr;
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-1">
                      {art.description}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Primary CTA Button */}
          {ctaText && ctaHref && (
            <div className="pt-2 text-center sm:text-left">
              <EmailButton href={ctaHref} variant="orange" showArrow>
                {ctaText}
              </EmailButton>
            </div>
          )}
        </div>
      </div>

      <EmailFooter variant="comprehensive" brandName={brandName} />
    </EmailCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Email Invitation Template (Candidate & Admin Invite) - HelloSmart Theme
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailInvitationTemplateProps {
  role?: 'candidate' | 'company_admin';
  recipientEmail?: string;
  orgName?: string;
  inviteUrl?: string;
  brandName?: string;
  expirationHours?: number;
}

export function EmailInvitationTemplate({
  role = 'candidate',
  recipientEmail = 'candidate.sathesh@example.com',
  orgName = 'Acme Robotics',
  inviteUrl = 'https://hellosmart.ai/accept-invite?token=sample_token',
  brandName = 'HelloSmart.ai',
  expirationHours = 72,
}: EmailInvitationTemplateProps) {
  const isCandidate = role === 'candidate';
  const roleName = isCandidate ? 'Candidate Assessment' : 'Company Administrator';
  const headline = isCandidate
    ? `You're invited to complete an assessment for ${orgName}`
    : `You're invited to join ${orgName} on HelloSmart`;

  const description = isCandidate
    ? `${orgName} has invited you to complete a practical work simulation on HelloSmart.ai. You will work in a realistic workspace environment with AI tools to solve real challenges.`
    : `You have been invited to join ${orgName} as a Company Administrator on HelloSmart.ai. You'll be able to create assessments, review candidate work, and manage your team's rubrics.`;

  const buttonText = isCandidate
    ? 'Start Candidate Assessment'
    : 'Activate Account & Set Password';

  return (
    <EmailCard>
      <EmailHeader variant="simple" brandName={brandName} />

      <div className="p-8 space-y-6">
        {/* Role Pill Badge (Orange Tint) */}
        <span className="inline-block px-3 py-1 text-xs font-bold rounded-full bg-[#fff7ed] text-[#c2410c] border border-[#fed7aa] uppercase tracking-wider">
          {roleName}
        </span>

        {/* Headline */}
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0b1f3a] leading-snug">
          {headline}
        </h1>

        <p className="text-sm text-neutral-600 leading-relaxed">
          {description}
        </p>

        {/* Metadata Details Box */}
        <div className="bg-neutral-50/90 rounded-xl border border-neutral-200/90 p-4 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-neutral-500">Organization:</span>
            <span className="font-bold text-[#0b1f3a]">{orgName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Role:</span>
            <span className="font-bold text-[#0b1f3a]">{roleName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Recipient:</span>
            <span className="font-medium text-[#0b1f3a]">{recipientEmail}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Link Security:</span>
            <span className="font-medium text-neutral-800">Single-use &bull; Expires in {expirationHours} hours</span>
          </div>
        </div>

        {/* Primary HelloSmart Orange CTA */}
        <div className="pt-2 text-center sm:text-left">
          <EmailButton href={inviteUrl} variant="orange" showArrow>
            {buttonText}
          </EmailButton>
        </div>

        {/* Fallback Direct URL Box */}
        <div className="pt-2 space-y-1.5 text-xs text-neutral-500">
          <p>If the button above does not work, copy and paste this link into your browser:</p>
          <div className="p-3 bg-neutral-100 rounded-lg font-mono text-[11px] text-[#c2410c] break-all select-all border border-neutral-200">
            {inviteUrl}
          </div>
        </div>

        <div className="pt-4 border-t border-neutral-100 text-xs text-neutral-500">
          <p>Thanks,</p>
          <p className="font-bold text-[#0b1f3a]">The {brandName} Team</p>
        </div>
      </div>

      <EmailFooter variant="social" brandName={brandName} />
    </EmailCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Email OTP Verification Code Template - HelloSmart Theme
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailOtpTemplateProps {
  code?: string | number;
  recipientName?: string;
  brandName?: string;
  expiresInMinutes?: number;
  verifyHref?: string;
}

export function EmailOtpTemplate({
  code = '3056',
  recipientName = 'Sathesh',
  brandName = 'HelloSmart.ai',
  expiresInMinutes = 10,
  verifyHref = 'https://hellosmart.ai/verify',
}: EmailOtpTemplateProps) {
  return (
    <EmailCard>
      <EmailHeader variant="simple" brandName={brandName} />

      <div className="p-8 space-y-6 text-center sm:text-left">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0b1f3a]">
            Verification Code
          </h1>
          <p className="text-sm text-neutral-600 mt-2">
            Hi {recipientName}, use the 4-digit code below to complete your verification:
          </p>
        </div>

        {/* 4 Large Digit Boxes Component */}
        <EmailOtpCode
          code={code}
          digits={4}
          accentColor="#fe7330"
          expiresInMinutes={expiresInMinutes}
        />

        {/* Verify CTA - Midnight Black */}
        <div className="text-center pt-2">
          <EmailButton href={verifyHref} variant="black">
            Verify email address
          </EmailButton>
        </div>

        <div className="pt-4 border-t border-neutral-100 text-xs text-neutral-500 space-y-2">
          <p>
            If you did not request this verification code, someone may be attempting to access your account. You can safely ignore this email.
          </p>
          <p className="pt-2">
            Thanks,<br />
            <span className="font-bold text-[#0b1f3a]">The {brandName} Team</span>
          </p>
        </div>
      </div>

      <EmailFooter variant="minimal" brandName={brandName} />
    </EmailCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Email Feature Notification Template (Black & Orange Glow) - HelloSmart Theme
// ─────────────────────────────────────────────────────────────────────────────

export interface EmailFeatureNotificationTemplateProps {
  featureName?: string;
  tagline?: string;
  description?: string;
  brandName?: string;
  ctaText?: string;
  ctaHref?: string;
}

export function EmailFeatureNotificationTemplate({
  featureName = 'AI Rubric Reviewers 2.0',
  tagline = 'Deep Code Analysis & Evidence Citation',
  description = 'We have upgraded all evaluation rubrics with independent AI reviewer agents that automatically analyze commits, terminal sessions, and diffs with line-level evidence references.',
  brandName = 'HelloSmart.ai',
  ctaText = 'Explore New Features',
  ctaHref = 'https://hellosmart.ai/features',
}: EmailFeatureNotificationTemplateProps) {
  return (
    <EmailCard>
      <EmailHeader variant="simple" brandName={brandName} />

      <div className="p-8">
        {/* Dark Banner with Vibrant HelloSmart Orange Glow */}
        <div className="w-full rounded-xl overflow-hidden border border-[#fe7330]/30 mb-6 bg-gradient-to-br from-[#0b1f3a] via-[#1a130f] to-[#431407] p-8 text-center text-white shadow-md">
          <span className="inline-block px-3 py-1 rounded-full text-[10px] font-extrabold bg-[#fe7330]/20 border border-[#fe7330] text-[#fe7330] tracking-wider uppercase mb-2">
            NEW CAPABILITY
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {featureName}
          </h2>
        </div>

        <div className="space-y-6 text-sm text-neutral-700 leading-relaxed">
          <p className="text-base text-neutral-600">
            {description}
          </p>

          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-2 text-xs">
            <span className="font-bold text-[#0b1f3a] block text-sm">Key Benefits:</span>
            <p className="text-neutral-600"><strong className="text-[#fe7330]">&bull;</strong> Objective, multi-agent evaluation without human evaluator bias</p>
            <p className="text-neutral-600"><strong className="text-[#fe7330]">&bull;</strong> Verifiable citation tags linking directly to candidate code snippets</p>
            <p className="text-neutral-600"><strong className="text-[#fe7330]">&bull;</strong> Automatic detection of reviewer score disagreement before final sign-off</p>
          </div>

          <div className="pt-2">
            <EmailButton href={ctaHref} variant="orange" showArrow>
              {ctaText}
            </EmailButton>
          </div>

          <div className="pt-4 border-t border-neutral-100 text-xs text-neutral-500">
            <p>Cheers,</p>
            <p className="font-bold text-[#0b1f3a]">The {brandName} Team</p>
          </div>
        </div>
      </div>

      <EmailFooter variant="preferences" brandName={brandName} />
    </EmailCard>
  );
}
