'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function UnlockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) {
      toast.error('Passkey Required', {
        description: 'Please enter your team or master passkey.',
      });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error('Access Denied', {
          description: data.error || 'Invalid passkey. Access denied.',
        });
        setIsLoading(false);
        return;
      }

      // Automatically determine destination based on role or original returnTo
      let target = data.redirectTo || '/docs';
      if (returnTo && returnTo !== '/docs' && !returnTo.startsWith('/unlock')) {
        target = returnTo;
      }

      toast.success(`Access Granted: ${data.roleConfig?.name || 'Authorized'}`, {
        description: `Entering ${data.roleConfig?.name || 'documentation'}...`,
      });

      // Set cookie on client immediately for instant propagation
      document.cookie = `hs_docs_role=${data.role}; path=/; max-age=604800; SameSite=Lax`;

      // Hard redirect immediately loads target route without client router stalls
      window.location.href = target;
    } catch {
      toast.error('Connection Error', {
        description: 'An unexpected network error occurred. Please try again.',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden bg-[#010912] text-white">
      {/* Fullscreen Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0 opacity-40"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
          type="video/mp4"
        />
      </video>

      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-[#010912]/60 backdrop-blur-[2px] z-0 pointer-events-none" />

      {/* Top Navigation */}
      <header className="relative z-10 w-full px-8 py-6">
        <div className="flex flex-row items-center justify-between max-w-7xl mx-auto w-full">
          <Link
            href="/"
            className="text-3xl tracking-tight text-white inline-flex items-baseline"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            <span>HelloSmart</span>
            <sup className="text-xs ml-0.5 font-sans">®</sup>
          </Link>

          <Link
            href="/"
            className="text-xs font-mono uppercase tracking-wider text-slate-400 hover:text-white transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Centered Passkey Card */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-12 my-auto max-w-xl mx-auto w-full">
        <h1
          className="text-5xl sm:text-6xl md:text-7xl leading-[0.98] tracking-[-1.5px] font-normal text-white mb-4 animate-fade-rise"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Authenticate Access
        </h1>

        <p className="text-[#9ca3af] text-sm sm:text-base max-w-md mx-auto mb-10 leading-relaxed animate-fade-rise-delay">
          Enter your passkey below. Your team perspective and architecture access will be detected automatically.
        </p>

        {/* Minimalist Liquid Glass Form */}
        <form
          onSubmit={handleUnlock}
          className="w-full max-w-md space-y-4 animate-fade-rise-delay-2"
        >
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your passkey..."
              required
              autoFocus
              autoComplete="current-password"
              className="text-center pr-12 h-14 text-base"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide passkey' : 'Show passkey'}
              className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <Button
            type="submit"
            disabled={isLoading || !password.trim()}
            variant="glass"
            size="lg"
            className="w-full h-14 font-medium flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span>Verifying credentials...</span>
            ) : (
              <>
                <span>Enter Documentation</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full py-6 text-center text-xs text-[#9ca3af]/60 font-mono tracking-wider">
        HelloSmart.ai • Role-Protected Engineering Platform
      </footer>
    </div>
  );
}

export default function UnlockPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#010912] flex items-center justify-center text-slate-400">
          Loading portal...
        </div>
      }
    >
      <UnlockForm />
    </Suspense>
  );
}
