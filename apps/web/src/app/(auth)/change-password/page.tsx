'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { BrandMark, Footer } from '@hs/ui';
import { SetPasswordForm } from '@/components/auth/set-password-form';

function ChangePasswordContent() {
  return (
    <main className="min-h-screen flex flex-col justify-center items-center p-4 sm:p-6 bg-canvas text-neutral-900 font-sans relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[350px] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md z-10 space-y-6">
        {/* Brand header */}
        <div className="text-center flex flex-col items-center">
          <Link href="/" className="inline-block mb-2 transition-transform hover:scale-105">
            <BrandMark size="lg" showSubtitle={false} />
          </Link>
        </div>

        {/* Reusable Accessible SetPasswordForm */}
        <SetPasswordForm
          requireCurrentPassword
          title="Change Password"
          subtitle="Choose a strong password to protect your HelloSmart account."
          submitLabel="Update Password"
          redirectTo="/login"
        />

        {/* Footer */}
        <Footer
          variant="auth"
          showLogo={false}
          showPoweredBy={false}
          authPrompt="Remember your password?"
          authActionText="Sign In"
          authActionHref="/login"
        />
      </div>
    </main>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <ChangePasswordContent />
    </Suspense>
  );
}
