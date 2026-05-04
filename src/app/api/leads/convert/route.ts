import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

const PLAN_AMOUNTS: Record<string, number> = { silver: 900, gold: 2200, platinum: 4200 }
const PLAN_LABELS: Record<string, string>  = { silver: 'Silver — $9/mo', gold: 'Gold — $22/mo', platinum: 'Platinum — $42/mo' }
const PLAN_PRICE : Record<string, string>  = { silver: '$9/mo', gold: '$22/mo', platinum: '$42/mo' }

export async function POST(req: Request) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { lead_id, plan, email, name, business_name } = body as {
    lead_id: string
    plan: string
    email: string
    name?: string
    business_name?: string
  }

  if (!lead_id || !plan || !email) {
    return NextResponse.json({ error: 'lead_id, plan, and email are required.' }, { status: 400 })
  }
  if (!['silver', 'gold', 'platinum'].includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://iebusinessconsultants.com'

  // Generate a personalised Stripe checkout session
  let checkoutUrl = `${appUrl}/accounting/checkout?plan=${plan}`

  if (process.env.STRIPE_SECRET_KEY) {
    try {
      const customer = await stripe.customers.create({
        email,
        name: name || undefined,
        metadata: {
          plan,
          source: 'lead_conversion',
          business_name: business_name || '',
          lead_id,
        },
      })

      const priceId = process.env[`STRIPE_PRICE_${plan.toUpperCase()}`] || ''
      const lineItems = priceId
        ? [{ price: priceId, quantity: 1 }]
        : [{
            price_data: {
              currency: 'usd',
              product_data: { name: `Efficient ${plan.charAt(0).toUpperCase() + plan.slice(1)} — Financial Infrastructure` },
              unit_amount: PLAN_AMOUNTS[plan],
              recurring: { interval: 'month' as const },
            },
            quantity: 1,
          }]

      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: lineItems,
        subscription_data: { trial_period_days: 30, metadata: { plan } },
        billing_address_collection: 'required',
        customer_update: { name: 'auto', address: 'auto' },
        metadata: { plan, customer_email: email, business_name: business_name || '', lead_id },
        success_url: `${appUrl}/accounting/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${appUrl}/accounting/checkout?canceled=true`,
        allow_promotion_codes: true,
      })

      if (checkoutSession.url) checkoutUrl = checkoutSession.url
    } catch (e) {
      console.error('Stripe checkout creation failed:', e)
      // Fall back to static checkout URL — still send email
    }
  }

  // Send the offer email via Resend
  let emailSent = false
  const firstName = (name || business_name || 'there').split(' ')[0]
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'IEBC Team <outreach@iebusinessconsultants.com>',
          to: email,
          subject: `Your Efficient ${planLabel} plan is ready — start your 30-day free trial`,
          text: `Hi ${firstName},\n\nYour Efficient ${planLabel} plan (${PLAN_PRICE[plan]}) is ready.\n\nClick below to start your 30-day free trial — no charge until day 31:\n\n${checkoutUrl}\n\nBest,\nIEBC Team`,
          html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:'Inter',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#0B2140;padding:28px 40px;">
      <div style="display:inline-flex;align-items:center;gap:10px;">
        <div style="width:32px;height:32px;background:#C8902A;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;">
          <span style="color:#fff;font-weight:900;font-size:9px;">EFF</span>
        </div>
        <span style="color:#fff;font-weight:800;font-size:18px;">Efficient</span>
      </div>
    </div>
    <div style="padding:36px 40px;">
      <h1 style="color:#0B2140;font-size:22px;font-weight:800;margin:0 0 6px;">Hi ${firstName}, your offer is ready</h1>
      <p style="color:#64748b;font-size:15px;line-height:1.6;margin:0 0 24px;">
        We've reserved a spot on the <strong style="color:#0B2140;">Efficient ${planLabel}</strong> plan for ${business_name || 'you'} — ${PLAN_PRICE[plan]}/month.
        Start your <strong>30-day free trial</strong> today. No charge until day 31, cancel anytime.
      </p>
      <a href="${checkoutUrl}"
         style="display:inline-block;background:linear-gradient(135deg,#0B2140,#17377A);color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin-bottom:28px;">
        Start My Free Trial →
      </a>
      <div style="background:#f8fafc;border-radius:10px;padding:20px;margin-bottom:24px;">
        <p style="color:#64748b;font-size:13px;margin:0 0 12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">What's included in ${planLabel}</p>
        <ul style="color:#475569;font-size:14px;line-height:2;padding-left:20px;margin:0;">
          <li>Full accounting & invoicing suite</li>
          <li>AI receipt scanner & bank sync</li>
          <li>Financial reports & cash flow forecast</li>
          ${plan !== 'silver' ? '<li>Bank reconciliation & auto-rules</li>' : ''}
          ${plan === 'platinum' ? '<li>Payroll, inventory & purchase orders</li>' : ''}
        </ul>
      </div>
      <p style="color:#94a3b8;font-size:13px;margin:0;">
        Questions? Reply to this email — we're here to help.<br>
        <a href="https://iebusinessconsultants.com" style="color:#0B2140;">iebusinessconsultants.com</a>
      </p>
    </div>
  </div>
</body>
</html>`,
        }),
      })
      emailSent = res.ok
    } catch (e) {
      console.error('Resend send failed:', e)
    }
  }

  // Log conversion activity (fail silently if table doesn't exist)
  await supabase.from('lead_activities').insert({
    lead_id,
    user_id: session.user.id,
    type: 'converted',
    subject: `Offer sent: Efficient ${planLabel} (${PLAN_PRICE[plan]})`,
    metadata: { plan, email, checkout_url: checkoutUrl, email_sent: emailSent, business_name },
  }).select().maybeSingle()

  // Mark lead as closed_won
  await supabase.from('leads')
    .update({ status: 'closed_won' })
    .eq('id', lead_id)
    .eq('user_id', session.user.id)
    .in('status', ['new', 'contacted', 'qualified'])

  return NextResponse.json({ checkout_url: checkoutUrl, email_sent: emailSent, configured: !!process.env.RESEND_API_KEY })
}
