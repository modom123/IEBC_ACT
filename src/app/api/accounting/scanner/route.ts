import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Monthly scan limits per plan (null = unlimited)
const PLAN_LIMITS: Record<string, number | null> = {
  silver:   20,
  gold:     100,
  platinum: null,
}

export async function GET() {
  // Return current usage + limit for the authenticated user
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const scanMonth = new Date().toISOString().slice(0, 7)

  const [{ data: profile }, { data: sub }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', userId).single(),
    supabase.from('subscriptions').select('plan, status').eq('user_id', userId).maybeSingle(),
  ])

  const isInternal = profile?.role === 'admin' || profile?.role === 'iebc_staff'
  const plan = sub?.plan ?? 'silver'
  const limit = isInternal ? null : (PLAN_LIMITS[plan] ?? 20)

  // Count this month's scans (fail open if table doesn't exist yet)
  let used = 0
  try {
    const { count } = await supabase
      .from('scanner_logs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('scan_month', scanMonth)
    used = count ?? 0
  } catch { /* table may not exist yet */ }

  return NextResponse.json({ used, limit, plan, isInternal })
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
const IMAGE_LIMIT = 10 * 1024 * 1024
const PDF_LIMIT   = 20 * 1024 * 1024

const EXTRACT_PROMPT = `You are an expert document scanning assistant for a business accounting and document management platform.

First, identify what TYPE of document this is. Then extract all relevant fields based on that type.

Respond ONLY with a valid JSON object — no markdown, no code fences, no explanation.

{
  "document_type": "one of: receipt | invoice | bill | contract | legal | id_card | bank_statement | tax_form | payroll | purchase_order | estimate | insurance | other",
  "confidence": "high | medium | low",

  // ── FINANCIAL fields (fill when document_type is receipt, invoice, bill, bank_statement, etc.) ──
  "vendor": "business or person name on the document, or null",
  "amount": total dollar amount as a number or null,
  "subtotal": subtotal before tax as number or null,
  "tax_amount": tax amount as number or null,
  "date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD for invoices/bills or null",
  "invoice_number": "invoice, receipt, or document reference number as string or null",
  "category": "one of: Revenue | Consulting | Product Sale | Payroll | Marketing | Software / SaaS | Office & Supplies | Travel | Legal & Professional | Taxes | Meals & Entertainment | Utilities | Insurance | Shipping | Rent | Equipment | Other Income | Other Expense | N/A",
  "type": "income | expense | N/A",
  "description": "brief description of what this document is about (max 100 chars)",
  "line_items": [{"description": "...", "qty": 1, "unit_price": 0.00, "amount": 0.00}],

  // ── IDENTITY / LEGAL fields (fill when document_type is id_card, contract, legal, etc.) ──
  "full_name": "person or entity name or null",
  "id_number": "license/ID number or null",
  "address": "full address or null",
  "date_of_birth": "YYYY-MM-DD or null",
  "expiration_date": "YYYY-MM-DD for IDs or null",
  "issuing_authority": "state, agency, or organization that issued this or null",
  "document_title": "official title of the document or null",
  "parties": ["list of names of parties involved in contracts/legal docs"],
  "key_dates": [{"label": "Notarized", "date": "YYYY-MM-DD"}],
  "notary": "notary public name if present or null",
  "case_or_reference_number": "any case, order, or reference number or null",

  // ── UNIVERSAL ──
  "raw_text_summary": "2-3 sentence summary of what this document is and what it says"
}

Rules:
- Extract ALL visible text including handwritten fields
- For handwritten fields, read them carefully — they are often names, dates, amounts, or locations
- Set fields to null if not present — do not guess
- line_items: return [] if none visible
- parties: return [] if none visible
- key_dates: return [] if none visible
- Be thorough on multi-page PDFs
- NEVER return an error for "wrong document type" — always extract what you can`

export async function POST(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI scanner is not configured. Add ANTHROPIC_API_KEY to environment variables.' }, { status: 503 })
  }

  const supabase = createServerSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = session.user.id
  const scanMonth = new Date().toISOString().slice(0, 7)

  // ── Plan limit check ──────────────────────────────────────────────
  try {
    const [{ data: profile }, { data: sub }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', userId).single(),
      supabase.from('subscriptions').select('plan, status').eq('user_id', userId).maybeSingle(),
    ])
    const isInternal = profile?.role === 'admin' || profile?.role === 'iebc_staff'
    if (!isInternal) {
      const plan = sub?.plan ?? 'silver'
      const monthlyLimit = PLAN_LIMITS[plan] ?? 20
      if (monthlyLimit !== null) {
        const { count } = await supabase
          .from('scanner_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('scan_month', scanMonth)
        if ((count ?? 0) >= monthlyLimit) {
          return NextResponse.json({
            error: `You've used all ${monthlyLimit} scans for this month on the ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan. Upgrade for more scans.`,
            limit_reached: true, used: count, limit: monthlyLimit, plan,
          }, { status: 429 })
        }
      }
    }
  } catch { /* fail open if table not yet created */ }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const isPdf   = file.type === 'application/pdf'
    const isImage = IMAGE_TYPES.includes(file.type) || file.type.startsWith('image/')

    if (!isPdf && !isImage) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload a JPG, PNG, WebP, HEIC image or a PDF.' },
        { status: 400 }
      )
    }

    const limit = isPdf ? PDF_LIMIT : IMAGE_LIMIT
    if (file.size > limit) {
      return NextResponse.json(
        { error: `File too large. Max ${isPdf ? '20MB for PDFs' : '10MB for images'}.` },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    type ContentBlock = Parameters<typeof anthropic.messages.create>[0]['messages'][0]['content'][number]

    const fileBlock: ContentBlock = isPdf
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: (file.type.startsWith('image/') ? file.type : 'image/jpeg') as
              'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data: base64,
          },
        }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            fileBlock,
            { type: 'text', text: EXTRACT_PROMPT },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

    let extracted: Record<string, unknown>
    try {
      extracted = JSON.parse(text)
    } catch {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        extracted = JSON.parse(match[0])
      } else {
        return NextResponse.json(
          { error: 'AI could not read this document. Try a clearer photo with better lighting.' },
          { status: 422 }
        )
      }
    }

    // Determine if this is a financial document
    const financialTypes = ['receipt', 'invoice', 'bill', 'bank_statement', 'purchase_order', 'estimate', 'payroll', 'tax_form']
    const docType = String(extracted.document_type || 'other')
    const isFinancial = financialTypes.includes(docType)

    // Log the scan for usage tracking (non-blocking, fail silently)
    supabase.from('scanner_logs').insert({
      user_id:       userId,
      scan_month:    scanMonth,
      document_type: docType,
      file_name:     file.name,
    }).then(() => {}).catch(() => {})

    return NextResponse.json({
      // Universal
      document_type:    extracted.document_type    ?? 'other',
      confidence:       extracted.confidence        ?? 'medium',
      raw_text_summary: extracted.raw_text_summary  ?? null,
      is_financial:     isFinancial,

      // Financial
      vendor:           extracted.vendor            ?? null,
      amount:           extracted.amount            ?? null,
      subtotal:         extracted.subtotal           ?? null,
      tax_amount:       extracted.tax_amount         ?? null,
      date:             extracted.date               ?? (isFinancial ? new Date().toISOString().split('T')[0] : null),
      due_date:         extracted.due_date           ?? null,
      invoice_number:   extracted.invoice_number    ?? null,
      category:         extracted.category           ?? (isFinancial ? 'Other Expense' : 'N/A'),
      type:             extracted.type               ?? (isFinancial ? 'expense' : 'N/A'),
      description:      extracted.description        ?? extracted.document_title ?? extracted.raw_text_summary ?? '',
      line_items:       Array.isArray(extracted.line_items) ? extracted.line_items : [],

      // Identity / Legal
      full_name:              extracted.full_name             ?? null,
      id_number:              extracted.id_number             ?? null,
      address:                extracted.address               ?? null,
      date_of_birth:          extracted.date_of_birth         ?? null,
      expiration_date:        extracted.expiration_date        ?? null,
      issuing_authority:      extracted.issuing_authority     ?? null,
      document_title:         extracted.document_title        ?? null,
      parties:                Array.isArray(extracted.parties) ? extracted.parties : [],
      key_dates:              Array.isArray(extracted.key_dates) ? extracted.key_dates : [],
      notary:                 extracted.notary                ?? null,
      case_or_reference_number: extracted.case_or_reference_number ?? null,
    })
  } catch (err) {
    console.error('Scanner error:', err)
    return NextResponse.json({ error: 'Failed to process document. Please try again.' }, { status: 500 })
  }
}
