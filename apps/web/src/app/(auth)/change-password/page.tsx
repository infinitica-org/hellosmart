'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import {
  BrandMark,
  PasswordField,
  Button,
  Card,
  Alert,
  Footer,
} from '@hs/ui';

function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newPassword || !confirmPassword) {
      setErrorMessage('Please fill in all required password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('New password and confirmation password do not match.');
      return;
    }

    setIsLoading(true);

    try {
      // Simulate / perform password change
      await new Promise((resolve) => setTimeout(resolve, 800));
      setIsLoading(false);
      setSuccessMessage(
        'Password updated successfully! You can now sign in with your new credentials.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setIsLoading(false);
      setErrorMessage('An unexpected error occurred. Please try again.');
    }
  };

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
          <h1 className="text-2xl font-medium tracking-tight text-neutral-900 mt-2">
            Change Password
          </h1>
          <p className="text-sm text-neutral-500 font-normal mt-1">
            Choose a strong password to protect your HelloSmart account.
          </p>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <Alert variant="success" className="text-xs">
            <div>
              <p className="font-medium">{successMessage}</p>
              <Link
                href="/login"
                className="inline-block mt-2 text-xs font-semibold text-emerald-700 hover:text-emerald-900 underline"
              >
                Proceed to Sign In →
              </Link>
            </div>
          </Alert>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <Alert variant="error" className="text-xs">
            {errorMessage}
          </Alert>
        )}

        {/* Form Card */}
        <Card className="p-6 sm:p-8 space-y-5 shadow-lg shadow-neutral-900/5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              id="current-password"
              name="currentPassword"
              label="Current Password"
              disabled={isLoading}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••••••"
            />

            <PasswordField
              id="new-password"
              name="newPassword"
              label="New Password (min 8 characters)"
              required
              disabled={isLoading}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
            />

            <PasswordField
              id="confirm-password"
              name="confirmPassword"
              label="Confirm New Password"
              required
              disabled={isLoading}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              isLoading={isLoading}
              className="bg-primary hover:bg-primary-hover text-white border-transparent font-medium mt-2"
            >
              Update Password →
            </Button>
          </form>

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="text-xs text-neutral-500 hover:text-neutral-800 transition font-light"
            >
              ← Back to Sign In
            </Link>
          </div>
        </Card>

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
      <ChangePasswordForm />
    </Suspense>
  );
}
