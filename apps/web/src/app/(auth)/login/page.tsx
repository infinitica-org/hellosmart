'use client';

import React, { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage(): React.JSX.Element {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white px-6 py-8 shadow-xl ring-1 ring-slate-900/5 sm:rounded-2xl sm:px-10 space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Sign In to HelloSmart
          </h1>
          <p className="text-sm text-slate-500">
            Access your assessments and company workspace
          </p>
        </div>

        <Suspense fallback={<div className="text-center py-6 text-sm text-slate-500">Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
