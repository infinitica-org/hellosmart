import React from 'react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-hidden bg-[#010912]">
      {/* Fullscreen Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
          type="video/mp4"
        />
      </video>

      {/* Navigation Bar */}
      <header className="relative z-10 w-full px-8 py-6">
        <nav className="flex flex-row items-center justify-between max-w-7xl mx-auto w-full">
          {/* Logo */}
          <Link
            href="/"
            className="text-3xl tracking-tight text-white inline-flex items-baseline"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            <span>HelloSmart</span>
            <sup className="text-xs ml-0.5 font-sans">®</sup>
          </Link>

          {/* Navigation Links (hidden on mobile, visible on desktop) */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="text-sm font-medium text-white transition-colors"
            >
              Home
            </Link>
            <Link
              href="/docs/architecture/system-architecture"
              className="text-sm font-medium text-[#9ca3af] hover:text-white transition-colors"
            >
              Architecture
            </Link>
            <Link
              href="/docs/database/db-visualization"
              className="text-sm font-medium text-[#9ca3af] hover:text-white transition-colors"
            >
              Database
            </Link>
            <Link
              href="/docs/api/overview"
              className="text-sm font-medium text-[#9ca3af] hover:text-white transition-colors"
            >
              API Reference
            </Link>
            <Link
              href="/docs/production/release-runbook"
              className="text-sm font-medium text-[#9ca3af] hover:text-white transition-colors"
            >
              Production
            </Link>
            <Link
              href="/docs/roles/sde"
              className="text-sm font-medium text-[#9ca3af] hover:text-white transition-colors"
            >
              Playbooks
            </Link>
          </div>

          {/* CTA Button */}
          <Link
            href="/docs"
            className="liquid-glass rounded-full px-6 py-2.5 text-sm text-white hover:scale-[1.03] transition-transform"
          >
            Explore Docs
          </Link>
        </nav>
      </header>

      {/* Cinematic Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-32 pb-40 py-[90px] my-auto">
        <h1
          className="text-5xl sm:text-7xl md:text-8xl leading-[0.95] tracking-[-2.46px] max-w-7xl font-normal text-white animate-fade-rise"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Where <em className="not-italic text-[#9ca3af]">real craft</em> rises{' '}
          <em className="not-italic text-[#9ca3af]">through the noise.</em>
        </h1>

        <p className="text-[#9ca3af] text-base sm:text-lg max-w-2xl mt-8 leading-relaxed animate-fade-rise-delay">
          We&apos;re designing tools for deep thinkers, bold creators, and quiet rebels.
          Beyond artificial puzzles, we build controlled digital spaces for sharp focus
          and inspired work.
        </p>

        <Link
          href="/docs"
          className="liquid-glass rounded-full px-14 py-5 text-base text-white mt-12 hover:scale-[1.03] transition-transform cursor-pointer animate-fade-rise-delay-2"
        >
          Begin Journey
        </Link>
      </main>

      {/* Footer subtle brandmark */}
      <footer className="relative z-10 w-full py-6 text-center text-xs text-[#9ca3af]/60 font-mono tracking-wider">
        HelloSmart.ai • AI-Native Hiring Platform
      </footer>
    </div>
  );
}
