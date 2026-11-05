import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  EmailLetterTemplate,
  EmailAnnouncementTemplate,
  EmailInvitationTemplate,
  EmailOtpTemplate,
  EmailFeatureNotificationTemplate,
} from './mail-templates';
import { EmailHeader } from './mail-header';
import { EmailFooter } from './mail-footer';
import { EmailOtpCode } from './mail-otp-code';
import { EmailHero } from './mail-hero';
import { EmailCard } from './mail-card';

const meta: Meta = {
  title: 'Mail/Templates',
  parameters: {
    layout: 'centered',
  },
};

export default meta;

export const LetterTemplate: StoryObj<typeof EmailLetterTemplate> = {
  name: '1. Letter & Editorial Template',
  render: () => (
    <div className="w-[620px] max-w-full p-4 bg-neutral-100 rounded-xl">
      <EmailLetterTemplate
        recipientName="Sathesh"
        subject="Your HelloSmart assessment environment is provisioned"
        brandName="HelloSmart.ai"
      />
    </div>
  ),
};

export const AnnouncementTemplate: StoryObj<typeof EmailAnnouncementTemplate> = {
  name: '2. Announcement & Newsletter Template',
  render: () => (
    <div className="w-[620px] max-w-full p-4 bg-neutral-100 rounded-xl">
      <EmailAnnouncementTemplate
        badgeText="ANNOUNCING OUR LATEST UPDATE"
        headline="Hire with confidence through realistic work simulations"
        brandName="HelloSmart.ai"
      />
    </div>
  ),
};

export const InvitationTemplate: StoryObj<typeof EmailInvitationTemplate> = {
  name: '3. Invitation & Welcome Template',
  render: () => (
    <div className="w-[620px] max-w-full p-4 bg-neutral-100 rounded-xl">
      <EmailInvitationTemplate
        role="candidate"
        orgName="Acme Corp"
        recipientEmail="candidate@domain.com"
        inviteUrl="https://hellosmart.ai/accept-invite?token=hs_inv_test_token"
      />
    </div>
  ),
};

export const OtpVerificationTemplate: StoryObj<typeof EmailOtpTemplate> = {
  name: '4. OTP Verification Code Template',
  render: () => (
    <div className="w-[620px] max-w-full p-4 bg-neutral-100 rounded-xl">
      <EmailOtpTemplate
        code="3056"
        recipientName="Sathesh"
        expiresInMinutes={10}
        brandName="HelloSmart.ai"
      />
    </div>
  ),
};

export const FeatureNotificationTemplate: StoryObj<typeof EmailFeatureNotificationTemplate> = {
  name: '5. 3D Glass Feature Launch Template',
  render: () => (
    <div className="w-[620px] max-w-full p-4 bg-neutral-100 rounded-xl">
      <EmailFeatureNotificationTemplate
        featureName="Independent Rubric Reviewers"
        brandName="HelloSmart.ai"
      />
    </div>
  ),
};

export const HeaderVariants: StoryObj = {
  name: 'Headers: All 5 Variants',
  render: () => (
    <div className="w-[580px] max-w-full space-y-4 p-4 bg-neutral-100 rounded-xl">
      <div className="bg-white rounded-xl shadow-xs overflow-hidden">
        <p className="text-[10px] uppercase font-bold text-neutral-400 px-6 pt-3">Variant 1: Simple</p>
        <EmailHeader variant="simple" brandName="HelloSmart.ai" />
      </div>
      <div className="bg-white rounded-xl shadow-xs overflow-hidden">
        <p className="text-[10px] uppercase font-bold text-neutral-400 px-6 pt-3">Variant 2: With Nav</p>
        <EmailHeader variant="with-nav" brandName="HelloSmart.ai" />
      </div>
      <div className="bg-white rounded-xl shadow-xs overflow-hidden">
        <p className="text-[10px] uppercase font-bold text-neutral-400 px-6 pt-3">Variant 3: With Social</p>
        <EmailHeader variant="with-social" brandName="HelloSmart.ai" />
      </div>
      <div className="bg-white rounded-xl shadow-xs overflow-hidden">
        <p className="text-[10px] uppercase font-bold text-neutral-400 px-6 pt-3">Variant 4: Centered</p>
        <EmailHeader variant="centered" brandName="HelloSmart.ai" />
      </div>
      <div className="bg-white rounded-xl shadow-xs overflow-hidden">
        <p className="text-[10px] uppercase font-bold text-neutral-400 px-6 pt-3">Variant 5: With Action</p>
        <EmailHeader variant="with-action" brandName="HelloSmart.ai" actionText="Sign In" />
      </div>
    </div>
  ),
};

export const FooterVariants: StoryObj = {
  name: 'Footers: All 6 Variants',
  render: () => (
    <div className="w-[580px] max-w-full space-y-4 p-4 bg-neutral-100 rounded-xl">
      <div className="bg-white rounded-xl shadow-xs overflow-hidden">
        <p className="text-[10px] uppercase font-bold text-neutral-400 px-6 pt-3">Variant 1: Minimal</p>
        <EmailFooter variant="minimal" brandName="HelloSmart.ai" />
      </div>
      <div className="bg-white rounded-xl shadow-xs overflow-hidden">
        <p className="text-[10px] uppercase font-bold text-neutral-400 px-6 pt-3">Variant 2: Social</p>
        <EmailFooter variant="social" brandName="HelloSmart.ai" />
      </div>
      <div className="bg-white rounded-xl shadow-xs overflow-hidden">
        <p className="text-[10px] uppercase font-bold text-neutral-400 px-6 pt-3">Variant 3: Nav Links</p>
        <EmailFooter variant="nav" brandName="HelloSmart.ai" />
      </div>
      <div className="bg-white rounded-xl shadow-xs overflow-hidden">
        <p className="text-[10px] uppercase font-bold text-neutral-400 px-6 pt-3">Variant 4: App Download</p>
        <EmailFooter variant="app-download" brandName="HelloSmart.ai" />
      </div>
      <div className="bg-white rounded-xl shadow-xs overflow-hidden">
        <p className="text-[10px] uppercase font-bold text-neutral-400 px-6 pt-3">Variant 5: Comprehensive</p>
        <EmailFooter variant="comprehensive" brandName="HelloSmart.ai" />
      </div>
      <div className="bg-white rounded-xl shadow-xs overflow-hidden">
        <p className="text-[10px] uppercase font-bold text-neutral-400 px-6 pt-3">Variant 6: Preferences</p>
        <EmailFooter variant="preferences" brandName="HelloSmart.ai" />
      </div>
    </div>
  ),
};

