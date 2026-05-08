'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

const PLANS = [
  {
    id: 'silver',
    label: 'Silver',
    price: '$9',
    period: '/mo',
    consultants: 1,
    users: 1,
    desc: 'For individuals & solo founders.',
    badge: '',
    features: [
      '1 IEBC AI Consultant',
      '1 user account',
      'AI Document Scanner (20 scans/mo)',
      'Income & expense tracking',
      'Invoices & estimates',
      'Client payment portal',
      'Transaction history',
      'Monthly financial reports',
      'Email support',
    ],
  },
  {
    id: 'gold',
    label: 'Gold',
    price: '$22',
    period: '/mo',
    consultants: 3,
    users: 3,
    desc: 'For small teams & growing businesses.',
    badge: 'Most Popular',
    features: [
      '3 IEBC AI Consultants',
      'Up to 3 users',
      'Everything in Silver',
      'AI Document Scanner (100 scans/mo)',
      'Bank reconciliation',
      'Reports & dashboards',
      'Cash flow forecast',
      'Recurring transactions',
      'Budgets & automation rules',
      'Priority support',
    ],
  },
  {
    id: 'platinum',
    label: 'Platinum',
    price: '$42',
    period: '/mo',
    consultants: 5,
    users: 10,
    desc: 'Full accounting suite. Every module.',
    badge: '',
    features: [
      '5 IEBC AI Consultants',
      'Up to 10 users',
      'Everything in Gold',
      'AI Document Scanner (unlimited)',
      'Full 22-module accounting suite',
      'Payroll management',
      'Tax center & 1099s',
      'Inventory & purchase orders',
      'Mileage & time tracker',
      'Dedicated account manager',
    ],
  },
]


const STRIPE_LINKS: Record<string, string> = {
  silver:   process.env.NEXT_PUBLIC_STRIPE_LINK_SILVER   || '',
  gold:     process.env.NEXT_PUBLIC_STRIPE_LINK_GOLD     || '',
  platinum: process.env.NEXT_PUBLIC_STRIPE_LINK_PLATINUM || '',
}

function CheckoutContent() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isStripeError, setIsStripeError] = useState(false)
  const [canceled, setCanceled] = useState(false)
  const [required, setRequired] = useState(false)

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    businessName: '',
  })

  useEffect(() => {
    const planParam = searchParams.get('plan')
    if (planParam && ['silver', 'gold', 'platinum'].includes(planParam)) {
      setSelectedPlan(planParam)
      setStep(2)
    }
    if (searchParams.get('canceled') === 'true') {
      setCanceled(true)
    }
    if (searchParams.get('required') === '1') {
      setRequired(true)
    }
  }, [searchParams])

  const plan = PLANS.find(p => p.id === selectedPlan)

  function handleField(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedPlan) return

    const directLink = STRIPE_LINKS[selectedPlan]
    if (directLink) {
      try {
        const url = new URL(directLink)
        if (form.email) url.searchParams.set('prefilled_email', form.email)
        // Pass plan so the webhook can identify which subscription was purchased
        url.searchParams.set('client_reference_id', selectedPlan)
        window.location.href = url.toString()
        return
      } catch {
        // Invalid URL — fall through to API checkout
      }
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')

    // Save credentials to sessionStorage so success page can auto-sign-in
    sessionStorage.setItem('iebc_pending', JSON.stringify({
      email: form.email,
      password: form.password,
    }))

    // API checkout — Stripe collects name/phone/address on their page
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: selectedPlan,
          email: form.email,
          password: form.password,
          businessName: form.businessName,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Checkout failed')
      window.location.href = data.url
      return
    } catch (err: unknown) {
      // API failed — fall back to direct payment link (no auto-signin, check-email flow)
      const PLAN_LINKS: Record<string, string> = {
        silver:   process.env.NEXT_PUBLIC_STRIPE_LINK_SILVER   || 'https://buy.stripe.com/dRm7sF9Hr6kNbx0frVgEg03',
        gold:     process.env.NEXT_PUBLIC_STRIPE_LINK_GOLD     || 'https://buy.stripe.com/4gM8wJ8Dn10teJc6VpgEg02',
        platinum: process.env.NEXT_PUBLIC_STRIPE_LINK_PLATINUM || 'https://buy.stripe.com/bJe14h1aVeRj58CfrVgEg01',
      }
      const directLink = PLAN_LINKS[selectedPlan]
      if (directLink) {
        try {
          const url = new URL(directLink)
          if (form.email) url.searchParams.set('prefilled_email', form.email)
          url.searchParams.set('client_reference_id', selectedPlan)
          window.location.href = url.toString()
          return
        } catch { /* fall through */ }
      }
      setIsStripeError(true)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }


  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#0F4C81] rounded-lg flex items-center justify-center">
              <span className="text-white font-extrabold text-sm">I</span>
            </div>
            <span className="font-extrabold text-[#0F4C81] text-lg">IEBC</span>
            <span className="text-gray-400 text-sm">/ Financial Infrastructure</span>
          </Link>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className={`font-semibold ${step === 1 ? 'text-[#0F4C81]' : 'text-gray-400'}`}>1. Choose Plan</span>
            <span className="mx-1">→</span>
            <span className={`font-semibold ${step === 2 ? 'text-[#0F4C81]' : 'text-gray-400'}`}>2. Your Info</span>
            <span className="mx-1">→</span>
            <span className="text-gray-300 font-semibold">3. Payment</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {required && (
          <div className="mb-6 bg-[#0B2140] text-white text-sm px-5 py-4 rounded-xl flex items-start gap-3 shadow-md">
            <span className="text-xl shrink-0 mt-0.5">🔒</span>
            <div>
              <p className="font-bold mb-0.5">A subscription is required to access Efficient</p>
              <p className="text-white/70 text-xs">Choose a plan below to get started — all plans include a 30-day free trial with no charge until day 31.</p>
            </div>
          </div>
        )}

        {canceled && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center gap-2">
            <span>⚠</span> Payment was canceled. Your info is saved — just select a plan to try again.
          </div>
        )}

        {/* ── STEP 1: Plan Selection ── */}
        {step === 1 && (
          <>
            <div className="text-center mb-10">
              <p className="text-xs font-bold text-[#C9A02E] uppercase tracking-widest mb-2">Step 1 of 3</p>
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Choose your plan</h1>
              <p className="text-gray-500">All plans include a <span className="font-semibold text-gray-700">30-day free trial</span>. No charge until day 31.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {PLANS.map(p => {
                const isSelected = selectedPlan === p.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPlan(p.id)}
                    className={`rounded-2xl border-2 flex flex-col text-left transition-all relative bg-white w-full ${
                      isSelected
                        ? 'border-[#0F4C81] shadow-xl shadow-blue-100 ring-2 ring-[#0F4C81]/20'
                        : 'border-gray-200 hover:border-[#0F4C81]/40 hover:shadow-md'
                    }`}
                  >
                    {p.badge && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                        <span className="bg-[#C9A02E] text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-widest shadow-md whitespace-nowrap">
                          {p.badge}
                        </span>
                      </div>
                    )}
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-5 h-5 bg-[#0F4C81] rounded-full flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">✓</span>
                      </div>
                    )}
                    <div className="p-6 flex flex-col flex-1">
                      <div className="mb-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold mb-3 ${
                          p.id === 'silver' ? 'bg-slate-100 text-slate-600' :
                          p.id === 'gold' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-blue-50 text-[#0F4C81] border border-blue-200'
                        }`}>{p.label}</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-extrabold text-gray-900">{p.price}</span>
                          <span className="text-gray-400 text-sm">{p.period}</span>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{p.desc}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {p.consultants} IEBC AI Consultant{p.consultants > 1 ? 's' : ''} · Up to {p.users} user{p.users > 1 ? 's' : ''}
                        </p>
                      </div>
                      <ul className="space-y-2 flex-1 mb-4">
                        {p.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                            <span className="text-green-500 font-bold mt-0.5 shrink-0">✓</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => { if (selectedPlan) setStep(2) }}
                disabled={!selectedPlan}
                className="px-10 py-3.5 rounded-xl font-bold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed bg-[#0F4C81] hover:bg-[#082D4F] text-white shadow-lg"
              >
                Continue with {plan?.label ?? 'a plan'} →
              </button>
            </div>
            <p className="text-center text-xs text-gray-400 mt-4">
              30-day free trial · No charge until day 31 · Cancel anytime
            </p>
          </>
        )}

        {/* ── STEP 2: Your Info ── */}
        {step === 2 && plan && (
          <div className="max-w-xl mx-auto">
            <div className="text-center mb-8">
              <p className="text-xs font-bold text-[#C9A02E] uppercase tracking-widest mb-2">Step 2 of 3</p>
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Your information</h1>
              <p className="text-gray-500">Create your account — you&apos;ll be signed in automatically after payment.</p>
            </div>

            {/* Plan summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex items-center justify-between">
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-bold mr-2 ${
                  plan.id === 'silver' ? 'bg-slate-100 text-slate-600' :
                  plan.id === 'gold' ? 'bg-amber-50 text-amber-700' :
                  'bg-blue-50 text-[#0F4C81]'
                }`}>{plan.label}</span>
                <span className="text-sm text-gray-500">{plan.consultants} consultant{plan.consultants > 1 ? 's' : ''} · {plan.users} user{plan.users > 1 ? 's' : ''}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-extrabold text-gray-900">{plan.price}<span className="text-sm text-gray-400 font-normal">/mo</span></span>
                <button onClick={() => setStep(1)} className="text-xs text-[#0F4C81] hover:underline">Change</button>
              </div>
            </div>

            {/* What Stripe collects callout */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-2 flex items-start gap-2.5">
              <span className="text-blue-400 mt-0.5 shrink-0">ℹ</span>
              <p className="text-xs text-blue-700 leading-relaxed">
                Your name, phone, and billing address are collected securely on the next screen by Stripe — no need to enter them twice.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address <span className="text-red-500">*</span></label>
                <input name="email" type="email" required value={form.email} onChange={handleField}
                  placeholder="jane@company.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent" />
                <p className="text-xs text-gray-400 mt-1">This will be your login email.</p>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Create Password <span className="text-red-500">*</span></label>
                <input name="password" type="password" required value={form.password} onChange={handleField}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password <span className="text-red-500">*</span></label>
                <input name="confirmPassword" type="password" required value={form.confirmPassword} onChange={handleField}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent" />
              </div>

              {/* Business name — not collected by Stripe */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Business Name <span className="text-gray-400 font-normal">(optional)</span></label>
                <input name="businessName" type="text" value={form.businessName} onChange={handleField}
                  placeholder="Acme Corp"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent" />
              </div>

              {/* Error */}
              {error && (
                isStripeError ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 space-y-2">
                    <p className="font-semibold text-amber-800 text-sm">Payment setup in progress</p>
                    <p className="text-amber-700 text-sm">Book a quick call and we&apos;ll get your {plan.label} plan activated right away.</p>
                    <a href="https://calendly.com/new56money/30min" target="_blank" rel="noopener noreferrer"
                      className="block text-center py-2.5 rounded-lg font-bold text-sm transition-opacity hover:opacity-90 mt-1"
                      style={{ background: '#C9A02E', color: '#fff' }}>
                      Book a Call to Subscribe — {plan.price}/mo →
                    </a>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )
              )}

              <div className="pt-2">
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl font-bold text-sm bg-[#0F4C81] hover:bg-[#082D4F] text-white transition shadow-lg disabled:opacity-60 disabled:cursor-not-allowed">
                  {loading ? 'Redirecting to payment...' : `Continue to Payment — ${plan.price}/mo after trial`}
                </button>
                <p className="text-center text-xs text-gray-400 mt-3">
                  Secure checkout via Stripe · 30-day free trial · Cancel anytime
                </p>
              </div>
            </form>

            <div className="mt-4 text-center">
              <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-700">
                ← Back to plans
              </button>
            </div>
          </div>
        )}

        <div className="text-center mt-8 space-y-2">
          <p className="text-xs text-gray-400">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-[#0F4C81] hover:underline font-medium">Sign in here</Link>
          </p>
          <p className="text-xs text-gray-300">
            By subscribing you agree to our{' '}
            <Link href="/terms" className="text-gray-400 hover:text-gray-600 underline">Terms of Service</Link>
            {' '}and{' '}
            <Link href="/privacy" className="text-gray-400 hover:text-gray-600 underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </main>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-gray-400 text-sm">Loading...</div></div>}>
      <CheckoutContent />
    </Suspense>
  )
}
