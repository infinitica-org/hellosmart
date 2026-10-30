'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BrandMark, Footer, Alert } from '@hs/ui';
import { SetPasswordForm } from '@/components/auth/set-password-form';
import { changePassword, ApiError } from '@/lib/api-client';

function ChangePasswordContent() {
  const searchParams = useSearchParams();
  const isRequired = searchParams?.get('required') === 'true';

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

        {isRequired && (
          <Alert variant="warning" className="text-xs">
            Password reset is required for your account before you can continue to your portal.
          </Alert>
        )}

        {/* Reusable Accessible SetPasswordForm */}
        <SetPasswordForm
          requireCurrentPassword
          title={isRequired ? 'Reset Your Password' : 'Change Password'}
          subtitle={
            isRequired
              ? 'Please choose a strong new password to activate your account.'
              : 'Choose a strong password to protect your HelloSmart account.'
          }
          submitLabel={isRequired ? 'Set New Password' : 'Update Password'}
          redirectTo="/login"
          onSubmitPassword={async ({ currentPassword, newPassword }) => {
            if (!currentPassword) {
              return { success: false, errorMessage: 'Please enter your current password.' };
            }
            try {
              await changePassword({ currentPassword, newPassword });
              return { success: true };
            } catch (err: unknown) {
              if (err instanceof ApiError) {
                return {
                  success: false,
                  errorCode: err.code,
                  errorMessage: err.message,
                };
              }
              return {
                success: false,
                errorMessage: err instanceof Error ? err.message : 'Failed to update password.',
              };
            }
          }}
        />

        {/* Footer */}
        <div className="text-center space-y-3">
          <p className="text-xs text-neutral-500">
            Forgot your current password?{' '}
            <Link
              href="/login?help=forgot-password"
              className="text-primary hover:text-primary-hover font-medium underline underline-offset-2"
            >
              Get reset help
            </Link>
          </p>

          <Footer
            variant="auth"
            showLogo={false}
            showPoweredBy={false}
            authPrompt="Remember your password?"
            authActionText="Sign In"
            authActionHref="/login"
          />
        </div>
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
