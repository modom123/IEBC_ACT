import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST: verify Stripe session and provision account using the password the
// user entered on the checkout form (never stored outside their browser).
export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }

  let sessionId: string
  let password: string | undefined

  try {
    const body = await req.json()
    sessionId = body.session_id
    password = body.password // provided by the client from sessionStorage
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return NextResponse.json({ ready: false })
    }

    const email = session.customer_details?.email ?? session.metadata?.customer_email ?? ''
    const name = session.customer_details?.name ?? ''
    const phone = session.customer_details?.phone ?? ''
    const plan = session.metadata?.plan ?? session.client_reference_id ?? ''
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : ''
    const stripeSubId = typeof session.subscription === 'string' ? session.subscription : ''

    if (!email) {
      return NextResponse.json({ ready: false })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ready: true, email, plan })
    }

    const supabase = getAdminClient()

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    let userId: string

    if (existingProfile?.id) {
      userId = existingProfile.id
      await supabase.from('profiles').update({
        plan,
        stripe_customer_id: stripeCustomerId,
      }).eq('id', userId)
      // If webhook created the user without a password, set it now
      if (password) {
        await supabase.auth.admin.updateUserById(userId, { password })
      }
    } else {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password: password || undefined,
        email_confirm: true,
        user_metadata: { full_name: name, plan, stripe_customer_id: stripeCustomerId },
      })

      if (createErr || !created?.user) {
        console.error('Failed to create user:', createErr)
        return NextResponse.json({ ready: false })
      }

      userId = created.user.id

      const addr = session.customer_details?.address
      const billingAddress = {
        street: addr?.line1 ?? '',
        city: addr?.city ?? '',
        state: addr?.state ?? '',
        zip: addr?.postal_code ?? '',
        country: addr?.country ?? '',
      }

      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: name,
        phone,
        plan,
        stripe_customer_id: stripeCustomerId,
        billing_address: JSON.stringify(billingAddress),
        role: 'user',
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    }

    await supabase.from('subscriptions').upsert({
      user_id: userId,
      plan,
      stripe_subscription_id: stripeSubId,
      stripe_customer_id: stripeCustomerId,
      status: 'trialing',
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    return NextResponse.json({ ready: true, email, plan })
  } catch (err) {
    console.error('Checkout complete error:', err)
    return NextResponse.json({ ready: false })
  }
}
