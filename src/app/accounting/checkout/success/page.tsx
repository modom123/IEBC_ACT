'use client'
import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Suspense } from 'react'

type Status = 'loading' | 'signing-in' | 'ready' | 'error'

function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session_id')
  const [status, setStatus] = useState<Status>('loading')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [plan, setPlan] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const attemptsRef = useRef(0)

  useEffect(() => {
    if (!sessionId) {
      setStatus('error')
      return
    }

    // Restore password from sessionStorage (set before redirecting to Stripe)
    const pending = sessionStorage.getItem('iebc_pending')
    const saved = pending ? JSON.parse(pending) : null

    async function poll() {
      attemptsRef.current++

      // Give up after ~90 seconds (45 attempts × 2s)
      if (attemptsRef.current > 45) {
        clearInterval(pollRef.current!)
        setStatus('error')
        return
      }

      try {
        const res = await fetch('/api/stripe/checkout/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            password: saved?.password || undefined,
          }),
        })
        const data = await res.json()

        if (!data.ready) return // keep polling

        clearInterval(pollRef.current!)

        const resolvedEmail = data.email || saved?.email || ''
        const resolvedPassword = saved?.password || ''
        const resolvedPlan = data.plan || ''

        setEmail(resolvedEmail)
        setPassword(resolvedPassword)
        setPlan(resolvedPlan)

        // Auto-sign in if we have credentials
        if (resolvedEmail && resolvedPassword) {
          setStatus('signing-in')
          try {
            const supabase = createClient()
            const { error } = await supabase.auth.signInWithPassword({
              email: resolvedEmail,
              password: resolvedPassword,
            })
            if (!error) {
              sessionStorage.removeItem('iebc_pending')
              // Brief pause so user sees the success message before redirect
              setTimeout(() => router.push('/accounting'), 2500)
              setStatus('ready')
              return
            }
          } catch { /* fall through to show credentials */ }
        }

        setStatus('ready')
      } catch { /* network error — keep polling */ }
    }

    poll()
    pollRef.current = setInterval(poll, 2000)
    return () => clearInterval(pollRef.current!)
  }, [sessionId, router])

  function copyCredentials() {
    navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 relative">
            <div className="w-16 h-16 rounded-full border-4 border-[#0F4C81]/20 border-t-[#0F4C81] animate-spin" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Setting up your account…</h1>
          <p className="text-gray-500 text-sm">Your payment was received. Creating your account now — this takes just a moment.</p>
        </div>
      </main>
    )
  }

  if (status === 'signing-in') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Account ready! Signing you in…</h1>
          <p className="text-gray-500 text-sm">Taking you to your dashboard now.</p>
        </div>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-3">Payment received!</h1>
          <p className="text-gray-500 mb-6">Your account is being set up. You&apos;ll receive an email with your login credentials shortly.</p>
          <Link href="/auth/login"
            className="w-full block py-3.5 rounded-xl font-bold text-sm bg-[#0F4C81] hover:bg-[#082D4F] text-white transition shadow-lg text-center">
            Go to Login →
          </Link>
          <p className="text-xs text-gray-400 mt-4">
            Need help?{' '}
            <a href="mailto:support@iebusinessconsultants.com" className="text-[#0F4C81] hover:underline">
              support@iebusinessconsultants.com
            </a>
          </p>
        </div>
      </main>
    )
  }

  // status === 'ready'
  const PLAN_LABELS: Record<string, string> = { silver: 'Silver', gold: 'Gold', platinum: 'Platinum' }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full">
        {/* Success header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-1">You&apos;re all set!</h1>
          {plan && (
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#0F4C81] text-white mb-2">
              {PLAN_LABELS[plan] || plan} Plan — 30-day free trial started
            </span>
          )}
          <p className="text-gray-500 text-sm">Your account has been created. Save your credentials below.</p>
        </div>

        {/* Credentials card */}
        <div className="bg-white rounded-2xl border-2 border-[#0F4C81]/20 shadow-lg p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold text-gray-800 uppercase tracking-wide">Your Login Credentials</p>
            {email && password && (
              <button onClick={copyCredentials}
                className="text-xs text-[#0F4C81] font-semibold hover:underline">
                {copied ? '✓ Copied!' : 'Copy all'}
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Email</p>
              <p className="text-sm font-bold text-gray-900 break-all">{email || '—'}</p>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Password</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-gray-900 font-mono tracking-wider">
                  {password ? (showPassword ? password : '••••••••••') : '(use the password you created)'}
                </p>
                {password && (
                  <button onClick={() => setShowPassword(v => !v)}
                    className="text-xs text-gray-400 hover:text-gray-600 shrink-0">
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <p className="text-xs text-amber-600 font-medium mt-3 flex items-start gap-1.5">
            <span className="shrink-0">⚠</span>
            Save these credentials — they&apos;ve also been sent to your email.
          </p>
        </div>

        {/* CTA */}
        <Link href="/accounting"
          className="w-full block py-4 rounded-xl font-bold text-base bg-[#0F4C81] hover:bg-[#082D4F] text-white transition shadow-lg text-center mb-3">
          Go to My Dashboard →
        </Link>
        <Link href="/auth/login"
          className="w-full block py-3 rounded-xl font-semibold text-sm border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 transition text-center">
          Sign In Manually
        </Link>

        <p className="text-xs text-gray-400 text-center mt-5">
          Questions?{' '}
          <a href="mailto:support@iebusinessconsultants.com" className="text-[#0F4C81] hover:underline">
            support@iebusinessconsultants.com
          </a>
        </p>
      </div>
    </main>
  )
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
