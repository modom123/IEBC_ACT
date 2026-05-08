import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

// Use service role key so we can create users + write to any table
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature error:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getAdminClient()

  // Idempotency guard: skip if this event was already processed
  const { data: existing } = await supabase
    .from('stripe_events')
    .select('id')
    .eq('event_id', event.id)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ received: true })
  }
  await supabase.from('stripe_events').insert({ event_id: event.id, type: event.type })

  // ── 1. Checkout completed → create Supabase account + save profile ──
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    const email = session.customer_details?.email ?? session.metadata?.customer_email ?? ''
    const name = session.customer_details?.name ?? ''
    const phone = session.customer_details?.phone ?? ''
    const businessName = session.metadata?.business_name ?? ''
    // client_reference_id carries the plan when using direct Stripe payment links
    const plan = session.metadata?.plan ?? session.client_reference_id ?? ''
    const stripeCustomerId = typeof session.customer === 'string' ? session.customer : ''
    const stripeSubId = typeof session.subscription === 'string' ? session.subscription : ''

    // Stripe collects billing address on checkout — pull it from customer_details
    const addr = session.customer_details?.address
    const billingAddress = {
      street: addr?.line1 ?? '',
      city: addr?.city ?? '',
      state: addr?.state ?? '',
      zip: addr?.postal_code ?? '',
      country: addr?.country ?? '',
    }

    if (!email) {
      console.error('Webhook: no email in checkout session', session.id)
      return NextResponse.json({ received: true })
    }

    // Check if user already exists by querying profiles (avoids paginated listUsers)
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
        full_name: name || undefined,
        phone: phone || undefined,
        business_name: businessName || undefined,
        billing_address: JSON.stringify(billingAddress),
      }).eq('id', userId)
    } else {
      // New user — create without password; the success-page /complete endpoint
      // will set the real password using the value from the user's sessionStorage.
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { full_name: name, plan, stripe_customer_id: stripeCustomerId },
      })

      if (createErr || !created?.user) {
        console.error('Failed to create user:', createErr)
        return NextResponse.json({ received: true })
      }

      userId = created.user.id

      await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: name,
        phone,
        business_name: businessName,
        plan,
        stripe_customer_id: stripeCustomerId,
        billing_address: JSON.stringify(billingAddress),
        role: 'user',
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' })
    }

    // Save subscription record
    await supabase.from('subscriptions').upsert({
      user_id: userId,
      plan,
      stripe_subscription_id: stripeSubId,
      stripe_customer_id: stripeCustomerId,
      status: 'trialing',
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    // Track IEBC fee (0.76% platform fee)
    if (session.amount_total && session.amount_total > 0) {
      const feeCents = Math.round(session.amount_total * 0.0076)
      await supabase.from('iebc_fees').insert({
        payment_intent_id: session.payment_intent ?? session.id,
        gross_amount_cents: session.amount_total,
        iebc_fee_cents: feeCents,
        status: 'succeeded',
      }).select().maybeSingle()
    }

    // Notify admin hub of new subscriber (fails silently if table doesn't exist yet)
    await supabase.from('hub_notifications').insert({
      type: 'new_subscriber',
      title: `New subscriber: ${name || email}`,
      body: `${email} signed up for the ${plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Efficient'} plan`,
      metadata: { user_id: userId, plan, email, name },
      read_at: null,
    }).select().maybeSingle()

    // Welcome email via Resend (no-op if RESEND_API_KEY is not set)
    if (process.env.RESEND_API_KEY && email) {
      const planLabel = plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Efficient'
      const planPrice: Record<string, string> = { silver: '$9/mo', gold: '$22/mo', platinum: '$42/mo' }
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Efficient by IEBC <noreply@iebusinessconsultants.com>',
            to: email,
            subject: `Welcome to Efficient, ${name?.split(' ')[0] || 'there'}!`,
            html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#0B2140;padding:32px 40px;text-align:center;">
      <div style="display:inline-flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:36px;height:36px;background:#C8902A;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;">
          <span style="color:#fff;font-weight:900;font-size:10px;letter-spacing:-0.5px;">EFF</span>
        </div>
        <span style="color:#fff;font-weight:800;font-size:20px;">Efficient</span>
      </div>
      <p style="color:rgba(255,255,255,0.6);margin:0;font-size:13px;">by IEBC · Financial Infrastructure</p>
    </div>
    <div style="padding:40px;">
      <h1 style="color:#0B2140;font-size:24px;font-weight:800;margin:0 0 8px;">Welcome, ${name?.split(' ')[0] || 'there'}!</h1>
      <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 24px;">
        Your <strong style="color:#0B2140;">${planLabel}</strong> plan is now active${planPrice[plan] ? ` at <strong>${planPrice[plan]}</strong>` : ''}. You have full access to the Efficient accounting suite.
      </p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://iebusinessconsultants.com'}/accounting"
         style="display:inline-block;background:linear-gradient(135deg,#0B2140,#17377A);color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
        Go to Your Dashboard →
      </a>
      <div style="margin-top:32px;padding-top:24px;border-top:1px solid #f1f5f9;">
        <p style="color:#94a3b8;font-size:13px;margin:0 0 12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">What you can do now</p>
        <ul style="color:#64748b;font-size:14px;line-height:2;padding-left:20px;margin:0;">
          <li>Connect your bank account for automatic transaction import</li>
          <li>Create and send invoices to your clients</li>
          <li>Scan receipts with AI — snap a photo, we handle the rest</li>
          <li>Run payroll, track mileage, and manage your team</li>
        </ul>
      </div>
      <p style="color:#94a3b8;font-size:12px;margin-top:32px;">
        Questions? Reply to this email or visit <a href="https://iebusinessconsultants.com" style="color:#0B2140;">iebusinessconsultants.com</a>
      </p>
    </div>
  </div>
</body>
</html>`,
          }),
        })
      } catch {
        // Email failure should never break the webhook response
      }
    }
  }

  // ── 2. Subscription updated (active, trialing, past_due, etc.) ──
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    const plan = (subscription.metadata?.plan as string) || ''
    const newStatus = subscription.status

    await supabase
      .from('subscriptions')
      .update({
        status: newStatus,
        plan: plan || undefined,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id)
  }

  // ── 3. Subscription cancelled → revoke access ──
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription

    await supabase
      .from('subscriptions')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', subscription.id)

    // Notify admin hub of cancellation
    const cancelledEmail = subscription.metadata?.email || ''
    await supabase.from('hub_notifications').insert({
      type: 'subscription_cancelled',
      title: 'Subscription cancelled',
      body: `${cancelledEmail || 'A subscriber'} cancelled their ${subscription.metadata?.plan || ''} plan`,
      metadata: { stripe_subscription_id: subscription.id, plan: subscription.metadata?.plan },
      read_at: null,
    }).select().maybeSingle()
  }

  // ── 4. Payment failed → mark past_due ──
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    if (invoice.subscription) {
      await supabase
        .from('subscriptions')
        .update({
          status: 'past_due',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', invoice.subscription)

      // Notify admin hub
      const failedEmail = invoice.customer_email || ''
      await supabase.from('hub_notifications').insert({
        type: 'payment_failed',
        title: 'Payment failed',
        body: `${failedEmail || 'A subscriber'} — $${((invoice.amount_due ?? 0) / 100).toFixed(2)} could not be charged`,
        metadata: { stripe_subscription_id: invoice.subscription, amount: invoice.amount_due, email: failedEmail },
        read_at: null,
      }).select().maybeSingle()
    }
  }

  // ── 5. Payment succeeded → ensure active + track fee ──
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice

    if (invoice.subscription) {
      await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', invoice.subscription)
    }

    // Track IEBC platform fee
    if ((invoice.amount_paid ?? 0) > 0) {
      const feeCents = Math.round((invoice.amount_paid ?? 0) * 0.0076)
      await supabase.from('iebc_fees').insert({
        payment_intent_id: invoice.payment_intent ?? invoice.id,
        gross_amount_cents: invoice.amount_paid,
        iebc_fee_cents: feeCents,
        status: 'succeeded',
      }).select().maybeSingle()
    }
  }

  return NextResponse.json({ received: true })
}
