import React from 'react';
import Link from 'next/link';
import { TextureButton, BrandMark, Badge, Card, Footer } from '@hs/ui';

export default function HomePage() {
  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-canvas-alt text-neutral-900 font-sans overflow-x-hidden">
      {/* ========================================================================= */}
      {/* 1. TOP NAVIGATION BAR                                                    */}
      {/* ========================================================================= */}
      <header className="relative z-30 w-full max-w-7xl mx-auto px-6 sm:px-10 py-6 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2.5 group select-none">
          <BrandMark size="md" />
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
        {/* Background Landscape Art */}
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
          {/* Badge from @hs/ui */}
          <div className="mb-8">
            <Badge variant="primary" dot size="md" className="shadow-xs font-semibold uppercase tracking-widest text-[11px] py-1.5 px-4">
              Evidence-Backed Talent Network
            </Badge>
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
      {/* 3. CAPABILITIES / HOW IT WORKS SECTION (Cards from @hs/ui)               */}
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
            <Card className="p-8 bg-canvas-alt border-neutral-200/80 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-neutral-900/5 flex flex-col justify-between rounded-3xl">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold text-lg mb-6">
                  01
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                  Controlled Cloud Workspaces
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed font-light">
                  Candidates execute real assignments in sandboxed Cloud VMs with live terminals, VS Code environments, and dev servers.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-200 text-xs font-medium text-neutral-500">
                Full session autosave &amp; snapshot replay
              </div>
            </Card>

            {/* Card 2 */}
            <Card className="p-8 bg-canvas-alt border-neutral-200/80 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-neutral-900/5 flex flex-col justify-between rounded-3xl">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-neutral-900 text-white flex items-center justify-center font-bold text-lg mb-6">
                  02
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                  Governed AI Proxy
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed font-light">
                  Assess how effectively candidates pair with AI tools while our proxy strictly enforces token budgets, RPM limits, and policy compliance.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-200 text-xs font-medium text-neutral-500">
                Zero secret key leaks (BR-13 isolation)
              </div>
            </Card>

            {/* Card 3 */}
            <Card className="p-8 bg-canvas-alt border-neutral-200/80 hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-neutral-900/5 flex flex-col justify-between rounded-3xl">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center font-bold text-lg mb-6">
                  03
                </div>
                <h3 className="text-xl font-bold text-neutral-900 mb-2">
                  Evidence-Cited Reviewers
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed font-light">
                  Independent AI agents evaluate code architecture, problem-solving paths, and accuracy against your custom rubrics with mandatory evidence.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-neutral-200 text-xs font-medium text-neutral-500">
                Human admins make final decisions (BR-20)
              </div>
            </Card>
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
            <p className="text-neutral-400 text-base leading-relaxed font-light">
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
      {/* 5. MARKETING FOOTER (from @hs/ui)                                         */}
      {/* ========================================================================= */}
      <Footer
        variant="marketing"
        brandName="HelloSmart.ai"
        tagline="Hire by doing. Controlled simulation environments and multi-agent rubric scoring for AI-native engineering teams."
        showPoweredBy={true}
        columns={[
          {
            title: 'Platform',
            links: [
              { label: 'Cloud Workspaces', href: '#product' },
              { label: 'Governed AI Proxy', href: '#product' },
              { label: 'Reviewer Agents', href: '#product' },
              { label: 'Rubric Evaluator', href: '#product' },
            ],
          },
          {
            title: 'Solutions',
            links: [
              { label: 'Engineering Hiring', href: '#solutions' },
              { label: 'Bootcamp Certification', href: '#institutions' },
              { label: 'University Verification', href: '#institutions' },
              { label: 'Book a Demo (Cal.com)', href: 'https://cal.com', external: true },
            ],
          },
          {
            title: 'Portals',
            links: [
              { label: 'Master Sign In', href: '/login' },
              { label: 'Company Portal', href: '/company' },
              { label: 'Candidate Workspace', href: '/candidate' },
              { label: 'Admin Console', href: '/admin' },
            ],
          },
          {
            title: 'Legal',
            links: [
              { label: 'Privacy Policy', href: '/privacy' },
              { label: 'Terms of Service', href: '/terms' },
              { label: 'Security & Tenancy', href: '/security' },
              { label: 'Compliance (BR-01)', href: '/security' },
            ],
          },
        ]}
      />
    </div>
  );
}
