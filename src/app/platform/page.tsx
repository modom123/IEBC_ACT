import Link from 'next/link'
import MobileNav from '@/components/MobileNav'

const NAV_LINKS = [
  { label: 'Services', href: '#services' },
  { label: 'Infrastructure', href: '/efficient' },
  { label: 'Automation Hub', href: '/hub' },
  { label: 'Pricing', href: '#pricing' },
]

const SERVICES = [
  {
    number: '01',
    icon: '🏛️',
    title: 'Business Formation',
    subtitle: 'Start the right way.',
    body: 'LLC, S-Corp, and C-Corp setup handled for you. EIN registration, operating agreements, registered agent services, and compliance checklists — your legal foundation built in days, not weeks.',
    features: ['LLC · S-Corp · C-Corp', 'EIN registration', 'Operating agreements', 'Compliance checklists'],
    cta: { label: 'Start Formation', href: '/hub/formation' },
    accent: '#0F4C81',
    bg: '#EEF4FF',
  },
  {
    number: '02',
    icon: '🌐',
    title: 'Intelligent Websites',
    subtitle: 'A web presence that works for you.',
    body: 'We design and build high-performance websites powered by automation — lead capture, client portals, booking, and AI-driven content. Not just a site, a conversion engine for your business.',
    features: ['Custom design & build', 'Lead capture & CRM sync', 'Client payment portal', 'AI-powered content'],
    cta: { label: 'Learn More', href: '#services' },
    accent: '#7C3AED',
    bg: '#F5F3FF',
  },
  {
    number: '03',
    icon: '⚡',
    title: 'Automated Business Hubs',
    subtitle: 'Run your operations on autopilot.',
    body: 'A unified command center that automates your leads, tasks, team, and operations. Replace five disconnected tools with one hub that runs your business while you focus on growing it.',
    features: ['Lead pipeline & CRM', 'Task & project automation', 'Team management', 'Document vault'],
    cta: { label: 'Open the Hub', href: '/hub' },
    accent: '#C9A02E',
    bg: '#FFFBEB',
  },
  {
    number: '04',
    icon: '🏗️',
    title: 'Business Infrastructure',
    subtitle: 'The financial backbone of your business.',
    body: 'Full-stack accounting, invoicing, payroll, reconciliation, tax center, and real-time cash flow — all automated. The infrastructure layer that keeps your business compliant, funded, and financially clear.',
    features: ['Invoicing & payroll', 'Bank reconciliation', 'Tax center & 1099s', 'Cash flow forecasting'],
    cta: { label: 'Explore Infrastructure', href: '/efficient' },
    accent: '#059669',
    bg: '#ECFDF5',
  },
  {
    number: '05',
    icon: '🤖',
    title: 'IEBC Consultants',
    subtitle: '60 AI consultants. On demand.',
    body: 'A workforce of 60 specialized AI consultants across finance, marketing, operations, legal, HR, technology, and strategy — automatically routed to your business based on what you need, when you need it.',
    features: ['60 specialist consultants', 'Finance · Legal · Marketing', 'Operations · HR · Tech', 'Always available, no retainer'],
    cta: { label: 'Meet the Consultants', href: '/hub/consultants' },
    accent: '#0F4C81',
    bg: '#EEF4FF',
  },
]

const STATS = [
  { value: '5', label: 'core services' },
  { value: '60', label: 'AI consultants on demand' },
  { value: '25+', label: 'infrastructure modules' },
  { value: '30-day', label: 'free trial on all plans' },
]

const PLANS = [
  {
    id: 'silver',
    label: 'Silver',
    price: '$9',
    period: '/mo',
    desc: 'For individuals & solo founders.',
    consultants: 1,
    users: 1,
    highlight: false,
    features: [
      '1 IEBC AI Consultant',
      '1 user account',
      'AI receipt scanning',
      'Income & expense tracking',
      'Invoices & estimates',
      'Client payment portal',
      'Transaction history',
      'Monthly financial reports',
      'Email support',
    ],
    link: '/accounting/checkout?plan=silver',
    cta: 'Start Free Trial — $9/mo',
  },
  {
    id: 'gold',
    label: 'Gold',
    price: '$22',
    period: '/mo',
    desc: 'For small teams & growing businesses.',
    consultants: 3,
    users: 3,
    highlight: true,
    features: [
      '3 IEBC AI Consultants',
      'Up to 3 users',
      'AI receipt scanning',
      'Everything in Silver',
      'Automated Business Hub',
      'Lead pipeline & CRM',
      'Bank reconciliation',
      'Project tracking',
      'Priority support',
    ],
    link: '/accounting/checkout?plan=gold',
    cta: 'Start Free Trial — $22/mo',
  },
  {
    id: 'platinum',
    label: 'Platinum',
    price: '$42',
    period: '/mo',
    desc: 'All features. Full platform access.',
    consultants: 5,
    users: 10,
    highlight: false,
    features: [
      '5 IEBC AI Consultants',
      'Up to 10 users',
      'AI receipt scanning',
      'Everything in Gold',
      'Full accounting suite',
      'Payroll management',
      'Tax center & 1099s',
      'Business Formation support',
      'Dedicated account manager',
    ],
    link: '/accounting/checkout?plan=platinum',
    cta: 'Start Free Trial — $42/mo',
  },
]

const FOOTER_LINKS = {
  Services: [
    { label: 'Business Formation', href: '/hub/formation' },
    { label: 'Intelligent Websites', href: '#services' },
    { label: 'Automated Business Hubs', href: '/hub' },
    { label: 'Business Infrastructure', href: '/efficient' },
    { label: 'IEBC Consultants', href: '/hub/consultants' },
  ],
  Company: [
    { label: 'Agency Services', href: '/' },
    { label: 'Contact', href: '/#contact' },
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
  ],
  Account: [
    { label: 'Client Portal', href: '/auth/login' },
    { label: 'IEBC Consultants', href: '/auth/login?next=/hub/consultants' },
    { label: 'Create Account', href: '/auth/signup' },
    { label: 'Pricing', href: '#pricing' },
  ],
}

export default function PlatformPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900 font-sans">

      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-0 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#0F4C81] rounded-lg flex items-center justify-center shadow-md">
              <span className="text-white text-base font-extrabold">I</span>
            </div>
            <div className="leading-tight">
              <span className="text-[#0F4C81] font-extrabold text-lg tracking-tight">IEBC</span>
              <span className="hidden md:block text-[10px] text-gray-400 font-medium tracking-wide -mt-0.5">Platform</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-[#0F4C81] hover:bg-blue-50 rounded-lg transition"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="hidden md:block px-4 py-2 text-sm font-medium text-gray-500 hover:text-[#0F4C81] transition"
            >
              Agency Site
            </Link>
            <Link
              href="/auth/login"
              className="hidden md:block px-3 py-2 text-sm font-semibold text-[#0F4C81] border border-[#0F4C81]/30 rounded-lg hover:bg-blue-50 transition"
            >
              Client Portal
            </Link>
            <Link
              href="/auth/login?next=/hub/consultants"
              className="hidden md:block px-3 py-2 text-sm font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Consultants
            </Link>
            <Link href="/accounting/checkout?plan=silver" className="bg-[#0F4C81] hover:bg-[#082D4F] text-white px-5 py-2 rounded-lg text-sm font-bold transition shadow-sm">
              Get Started — $9/mo
            </Link>
            <MobileNav
              links={[
                { label: 'Services', href: '#services' },
                { label: 'Infrastructure', href: '/efficient' },
                { label: 'Automation Hub', href: '/hub' },
                { label: 'Pricing', href: '#pricing' },
              ]}
              cta={{ label: 'Get Started — $9/mo', href: '/accounting/checkout?plan=silver' }}
              loginHref="/auth/login"
              loginLabel="Client Portal"
              brandSub="Platform"
            />
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="relative bg-gradient-to-br from-[#F0F5FF] via-white to-[#FFF8E8] overflow-hidden border-b border-gray-100">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-[#0F4C81] opacity-5 rounded-full pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-[#C9A02E] opacity-5 rounded-full pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-[#0F4C81]/10 border border-[#0F4C81]/20 text-[#0F4C81] text-xs font-bold px-4 py-1.5 rounded-full mb-7 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            Self-Service Platform — From $9/mo
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold leading-tight mb-6 tracking-tight text-gray-900">
            Everything your business
            <br className="hidden sm:block" />
            needs to{' '}
            <span className="text-[#0F4C81]">build</span>,{' '}
            <span className="text-[#C9A02E]">run</span>, and{' '}
            <span className="text-[#059669]">grow</span>.
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
            5 integrated services — Formation, Websites, Automation Hubs, Infrastructure, and AI Consultants.
            <br />
            <span className="text-gray-800 font-semibold">One platform. Self-service. No setup fee.</span>
          </p>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center mb-8">
            <Link href="/accounting/checkout?plan=silver" className="bg-[#0F4C81] hover:bg-[#082D4F] text-white px-8 py-3.5 rounded-xl font-bold text-base transition shadow-lg text-center">
              Start Free — From $9/mo
            </Link>
            <Link href="#services" className="bg-white hover:bg-blue-50 border-2 border-[#0F4C81] text-[#0F4C81] px-8 py-3.5 rounded-xl font-bold text-base transition shadow-sm text-center">
              Explore Services
            </Link>
          </div>

          <p className="text-sm text-gray-400">No contracts · Cancel anytime · Starts at $9/mo</p>
        </div>

        <div className="bg-[#0F4C81]">
          <div className="max-w-5xl mx-auto px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {STATS.map((s, i) => (
              <div key={i}>
                <p className="text-xl sm:text-2xl font-extrabold text-white">{s.value}</p>
                <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Services ── */}
      <section id="services" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-bold text-[#C9A02E] uppercase tracking-widest mb-3">What We Do</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">5 services. One integrated platform.</h2>
            <p className="text-gray-500 mt-4 max-w-xl mx-auto">
              IEBC is not a single product — it is a complete business operating system. Each service is powerful alone, and unstoppable together.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SERVICES.map((s) => (
              <div
                key={s.number}
                className="rounded-2xl border border-gray-200 overflow-hidden hover:shadow-xl hover:border-transparent transition group flex flex-col"
              >
                <div className="p-1.5" style={{ background: s.bg }}>
                  <div className="flex items-center gap-2 px-4 py-3">
                    <span className="text-2xl">{s.icon}</span>
                    <span className="text-xs font-black tracking-widest uppercase" style={{ color: s.accent }}>{s.number}</span>
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-xl font-extrabold text-gray-900 mb-1">{s.title}</h3>
                  <p className="text-sm font-semibold mb-3" style={{ color: s.accent }}>{s.subtitle}</p>
                  <p className="text-sm text-gray-500 leading-relaxed mb-5">{s.body}</p>
                  <ul className="grid grid-cols-2 gap-1.5 mb-6 flex-1">
                    {s.features.map((f, fi) => (
                      <li key={fi} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span className="font-bold shrink-0" style={{ color: s.accent }}>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={s.cta.href}
                    className="text-center py-2.5 rounded-lg font-bold text-sm transition text-white"
                    style={{ background: s.accent }}
                  >
                    {s.cta.label}
                  </Link>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border-2 border-dashed border-gray-200 p-6 flex flex-col items-center justify-center text-center bg-gray-50 hover:border-[#0F4C81] transition">
              <div className="w-12 h-12 bg-[#0F4C81] rounded-xl flex items-center justify-center mb-4 shadow-md">
                <span className="text-white font-black text-sm">IE</span>
              </div>
              <h3 className="text-lg font-extrabold text-gray-900 mb-2">All 5 Services</h3>
              <p className="text-sm text-gray-500 mb-5">Get every IEBC service bundled in one Platinum plan. Formation to consultants — fully integrated.</p>
              <Link href="#pricing" className="bg-[#0F4C81] hover:bg-[#082D4F] text-white px-6 py-2.5 rounded-lg font-bold text-sm transition">
                See Platinum Plan
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 px-6 bg-[#F5F7FA]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-bold text-[#C9A02E] uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900">Simple, transparent pricing.</h2>
            <p className="text-gray-500 mt-4">All 5 services, bundled by plan. No hidden fees, no long-term contracts.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {PLANS.map(p => (
              <div
                key={p.id}
                className={`rounded-2xl border flex flex-col transition relative bg-white ${
                  p.highlight
                    ? 'border-[#0F4C81] shadow-2xl shadow-blue-100 ring-2 ring-[#0F4C81]/20'
                    : 'border-gray-200 hover:border-[#0F4C81] hover:shadow-lg'
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-[#C9A02E] text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-widest whitespace-nowrap shadow-md">
                      Most Popular
                    </span>
                  </div>
                )}
                <div className="p-7 flex flex-col flex-1">
                  <div className="mb-5">
                    <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold mb-3 ${
                      p.id === 'silver' ? 'bg-slate-100 text-slate-600' :
                      p.id === 'gold' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                      'bg-blue-50 text-[#0F4C81] border border-blue-200'
                    }`}>{p.label}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl font-extrabold text-gray-900">{p.price}</span>
                      <span className="text-gray-400 text-sm">{p.period}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{p.desc}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {p.consultants > 0 ? `${p.consultants} AI consultants · ` : ''}Up to {p.users} user{p.users > 1 ? 's' : ''}
                    </p>
                  </div>

                  <ul className="space-y-2.5 flex-1 mb-7">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-green-500 font-bold mt-0.5 shrink-0">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={p.link}
                    className={`text-center py-3 rounded-xl font-bold text-sm transition block shadow-sm ${
                      p.highlight
                        ? 'bg-[#0F4C81] hover:bg-[#082D4F] text-white'
                        : 'bg-[#0F4C81] hover:bg-[#082D4F] text-white'
                    }`}
                  >
                    {p.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-400 mt-8">
            All plans billed monthly. Cancel anytime. Secure payments via Stripe.
          </p>
        </div>
      </section>

      {/* ── Agency Callout ── */}
      <section className="py-20 px-6 bg-[#0F4C81] text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="relative max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest mb-3 text-blue-300">Done-For-You Option</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold mb-4">Need it done for you?</h2>
          <p className="text-blue-200 mb-8 text-base sm:text-lg">
            Our agency team builds your full system in 6 weeks — custom website, hub, infrastructure, and AI consultants.
            Starter at $1,500 setup.
          </p>
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center">
            <a
              href="https://calendly.com/new56money/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#C9A02E] hover:bg-yellow-600 text-white px-8 py-3.5 rounded-xl font-bold transition shadow-lg"
            >
              Book a Free Strategy Call
            </a>
            <Link
              href="/"
              className="bg-white hover:bg-blue-50 text-[#0F4C81] px-8 py-3.5 rounded-xl font-bold transition shadow-md"
            >
              View Agency Site →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-50 border-t border-gray-200 px-6 py-14">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-[#0F4C81] rounded-lg flex items-center justify-center shadow-sm">
                  <span className="text-white text-sm font-extrabold">I</span>
                </div>
                <span className="text-[#0F4C81] font-extrabold text-lg">IEBC</span>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed max-w-[200px]">
                Integrated Efficiency — 5 services to build, run, and grow your business.
              </p>
            </div>

            {Object.entries(FOOTER_LINKS).map(([group, links]) => (
              <div key={group}>
                <p className="text-xs font-bold text-gray-800 uppercase tracking-widest mb-4">{group}</p>
                <ul className="space-y-2.5">
                  {links.map(l => (
                    <li key={l.href}>
                      <Link href={l.href} className="text-sm text-gray-500 hover:text-[#0F4C81] transition">{l.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-200 pt-6 flex flex-col md:flex-row justify-between items-center gap-2">
            <p className="text-xs text-gray-400">© {new Date().getFullYear()} Integrated Efficiency (IEBC). All rights reserved.</p>
            <p className="text-xs text-gray-400">Secured by Supabase · Payments by Stripe</p>
          </div>
        </div>
      </footer>

    </main>
  )
}
