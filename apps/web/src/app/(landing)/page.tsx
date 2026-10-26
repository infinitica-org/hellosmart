import React from 'react';
import Link from 'next/link';
import { TextureButton } from '@hs/ui';

export default function HomePage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-canvas-alt text-neutral-900 font-sans overflow-x-hidden">
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION BAR (Exact match to reference mockup)                   */}
      {/* ========================================================================= */}
      <header className="relative z-30 w-full max-w-7xl mx-auto px-6 sm:px-10 py-6 flex items-center justify-between">
        {/* Brand Logo: Stylized Orange 'H' with Arrow + HelloSmart */}
        <Link href="/" className="inline-flex items-center gap-2.5 group select-none">
          {/* Logo icon */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
            <svg
              viewBox="0 0 36 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 text-primary"
              aria-label="HelloSmart Logo"
            >
              {/* Left Pillar */}
              <rect x="4" y="5" width="7" height="26" rx="2" fill="currentColor" />
              {/* Right Pillar */}
              <rect x="25" y="5" width="7" height="26" rx="2" fill="currentColor" />
              {/* Arrow Crossbar */}
              <path
                d="M11 18H23M23 18L18 13M23 18L18 23"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900">
            Hello<span className="text-neutral-900">Smart</span>
          </span>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-700">
          <a
            href="#product"
            className="hover:text-neutral-950 transition-colors"
          >
            Product
          </a>
          <a
            href="#solutions"
            className="hover:text-neutral-950 transition-colors"
          >
            Solutions
          </a>
          <a
            href="#institutions"
            className="hover:text-neutral-950 transition-colors"
          >
            For Institutions
          </a>
          <a
            href="#about"
            className="hover:text-neutral-950 transition-colors"
          >
            About
          </a>
        </nav>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-3">
          <TextureButton href="/login" variant="minimal" size="pill">
            Sign In
          </TextureButton>
          <TextureButton href="/login" variant="brand" size="pill">
            Get Started
          </TextureButton>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. HERO SECTION WITH IMAGE BACKGROUND                                    */}
      {/* ========================================================================= */}
      <section className="relative flex-1 flex flex-col items-center justify-center text-center px-6 pt-16 pb-40 sm:pt-24 sm:pb-60 overflow-hidden">
        {/* Background Landscape Art from wmremove-transformed.png */}
        <div className="absolute inset-0 pointer-events-none z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hero-bg.png"
            alt="HelloSmart Warm Horizon"
            className="w-full h-full object-cover object-bottom opacity-95"
          />
          {/* Subtle top gradient blending into the light cream background */}
          <div className="absolute inset-0 bg-gradient-to-b from-canvas-alt via-canvas-alt/40 to-transparent" />
        </div>

        {/* Content Container (Layered on top of background) */}
        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/25 mb-8 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
            <span className="text-xs font-semibold tracking-widest text-primary-700 uppercase">
              Evidence-Backed Talent Network
            </span>
          </div>

          {/* Hero Main Heading */}
          <h1 className="text-5xl sm:text-7xl md:text-[84px] font-light tracking-tight text-neutral-900 leading-[1.06] mb-6 font-sans">
            Discover talent beyond <br className="hidden sm:inline" />
            the résumé.
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-xl text-neutral-600 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
            HelloSmart connects talent, institutions, and opportunities through verified
            skills and real-world evidence.
          </p>

          {/* Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
            <TextureButton
              variant="primary"
              size="pillLg"
              className="w-full sm:w-auto shadow-xl shadow-neutral-900/15 hover:shadow-neutral-900/25 group cursor-pointer"
              asChild
            >
              <Link
                href="/login"
                className="flex items-center justify-center gap-2.5"
              >
                <span>Get Started</span>
                <span className="transition-transform group-hover:translate-x-1 font-bold">→</span>
              </Link>
            </TextureButton>

            <TextureButton
              variant="minimal"
              size="pillLg"
              className="w-full sm:w-auto cursor-pointer"
              asChild
            >
              <a href="#product">
                Explore HelloSmart
              </a>
            </TextureButton>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. CAPABILITIES / HOW IT WORKS SECTION (Neat UI Cards)                   */}
      {/* ========================================================================= */}
      <section id="product" className="relative z-10 bg-white/80 backdrop-blur-md border-t border-neutral-200/80 py-24 px-6 sm:px-12">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-semibold tracking-widest uppercase text-primary mb-3">
              Why HelloSmart
            </h2>
            <p className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 mb-4">
              Real Work. Governed AI. Objective Proof.
            </p>
            <p className="text-base text-neutral-600">
              Replace subjective interviews and unverified resumes with real-world work simulation and independent AI reviewer agents.
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="bg-canvas-alt rounded-3xl p-8 border border-neutral-200/80 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-neutral-900/5 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold text-lg mb-6">
                  01
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                  Controlled Cloud Workspaces
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Candidates execute real assignments in sandboxed Cloud VMs with live terminals, VS Code environments, and dev servers.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-200 text-xs font-medium text-neutral-500">
                Full session autosave &amp; snapshot replay
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-canvas-alt rounded-3xl p-8 border border-neutral-200/80 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-neutral-900/5 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-bold text-lg mb-6">
                  02
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                  Governed AI Proxy
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Assess how effectively candidates pair with AI tools while our proxy strictly enforces token budgets, RPM limits, and policy compliance.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-200 text-xs font-medium text-neutral-500">
                Zero secret key leaks (BR-13 isolation)
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-canvas-alt rounded-3xl p-8 border border-neutral-200/80 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-neutral-900/5 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold text-lg mb-6">
                  03
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                  Evidence-Cited Reviewers
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Independent AI agents evaluate code architecture, problem-solving paths, and accuracy against your custom rubrics with mandatory evidence.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-200 text-xs font-medium text-neutral-500">
                Human admins make final decisions (BR-20)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. INSTITUTIONS & ENTERPRISE TALENT NETWORK SECTION                       */}
      {/* ========================================================================= */}
      <section id="institutions" className="relative z-10 py-24 px-6 sm:px-12 bg-canvas-alt">
        <div className="max-w-6xl mx-auto rounded-3xl bg-neutral-900 text-white p-10 sm:p-16 flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl">
          <div className="max-w-xl">
            <span className="inline-block text-xs font-semibold tracking-widest text-primary uppercase mb-3">
              For Universities &amp; Bootcamps
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Validate your graduates with tamper-proof work credentials.
            </h2>
            <p className="text-neutral-400 text-base leading-relaxed">
              HelloSmart partners with educational institutions and enterprise talent programs to replace unverified CV claims with real-world execution portfolios.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 shrink-0 w-full md:w-auto">
            <TextureButton
              href="https://cal.com"
              target="_blank"
              variant="brand"
              size="hero"
              className="w-full sm:w-auto shadow-lg shadow-primary/25 cursor-pointer"
            >
              Partner with Us
            </TextureButton>

            <TextureButton
              href="/login"
              variant="minimal"
              size="hero"
              className="w-full sm:w-auto cursor-pointer"
            >
              Sign In to Portal
            </TextureButton>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. FOOTER                                                                */}
      {/* ========================================================================= */}
      <footer className="relative z-10 border-t border-neutral-200/80 bg-white py-12 px-6 sm:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
              <svg
                viewBox="0 0 36 36"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-7 h-7 text-primary"
              >
                <rect x="4" y="5" width="7" height="26" rx="2" fill="currentColor" />
                <rect x="25" y="5" width="7" height="26" rx="2" fill="currentColor" />
                <path
                  d="M11 18H23M23 18L18 13M23 18L18 23"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="font-bold text-neutral-900 tracking-tight">
              HelloSmart<span className="text-primary">.ai</span>
            </span>
            <span className="text-neutral-400 text-sm hidden sm:inline">|</span>
            <span className="text-neutral-500 text-sm hidden sm:inline">Hire by doing.</span>
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap items-center gap-6 text-sm text-neutral-600">
            <a href="#product" className="hover:text-neutral-950 transition-colors">
              Product
            </a>
            <a href="#solutions" className="hover:text-neutral-950 transition-colors">
              Solutions
            </a>
            <a href="#institutions" className="hover:text-neutral-950 transition-colors">
              Institutions
            </a>
            <Link href="/login" className="hover:text-neutral-950 transition-colors">
              Sign In
            </Link>
          </div>

          {/* Copyright */}
          <div className="text-xs text-neutral-500">
            &copy; {new Date().getFullYear()} HelloSmart.ai. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
