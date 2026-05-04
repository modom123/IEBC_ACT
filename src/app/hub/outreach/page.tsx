'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type Lead = {
  id: string
  business_name: string
  contact_email: string
  contact_name?: string
  industry: string
  heat: string
  status: string
  assigned_to: string | null
}

const TEMPLATES = [
  {
    id: 'intro',
    label: 'Introduction',
    subject: 'Quick question about {business}\'s back office',
    body: `Hi {name},

I came across {business} and wanted to reach out directly. At IEBC we help businesses like yours build the financial infrastructure they need to scale — without the enterprise price tag.

We offer a full accounting & invoicing suite, AI receipt scanning, bank sync, cash flow forecasting, and more — all starting at $9/month with a 30-day free trial.

Would you be open to a quick 15-minute call this week?

Best,
IEBC Team
https://iebusinessconsultants.com`,
  },
  {
    id: 'followup',
    label: 'Follow Up',
    subject: 'Following up — Efficient for {business}',
    body: `Hi {name},

Just following up on my earlier message — I know things get busy.

We've helped businesses in {industry} reduce their back-office overhead by 60%+ with our all-in-one platform. Full accounting, invoicing, payroll, and tax tools for one flat monthly fee.

Happy to do a quick 10-minute demo at your convenience — no pressure at all.

Best,
IEBC Team`,
  },
  {
    id: 'proposal',
    label: 'Send Offer',
    subject: 'Your Efficient plan offer — 30-day free trial inside',
    body: `Hi {name},

Based on what I know about {business}, I'd recommend our Gold plan ($22/mo) which includes:

• Full accounting & invoicing suite
• AI receipt scanner & bank sync
• Bank reconciliation & auto-categorization
• Cash flow forecasting & financial reports

You can start a 30-day free trial — no charge until day 31, cancel anytime:
https://iebusinessconsultants.com/accounting/checkout?plan=gold

Happy to answer any questions. Just reply here.

Best,
IEBC Team`,
  },
  {
    id: 'qualified',
    label: 'Qualified Check-In',
    subject: 'Checking in — did you get a chance to review Efficient?',
    body: `Hi {name},

Wanted to check in and see if you had a chance to review the Efficient platform for {business}.

A few things our clients love most:
• Bank connects automatically — no manual entry
• Invoices sent and tracked in seconds
• Tax estimates run in the background all year

I'd love to get you started. Let me know if you have any questions or want me to set up the account directly for you.

Best,
IEBC Team`,
  },
]

const HEAT_STYLES: Record<string, string> = {
  hot:  'bg-red-100 text-red-600',
  warm: 'bg-yellow-100 text-yellow-700',
  cold: 'bg-blue-100 text-blue-600',
}

function interpolate(text: string, lead: Lead) {
  const name = lead.contact_name || lead.business_name || 'there'
  const biz  = lead.business_name || 'your business'
  const ind  = lead.industry || 'your industry'
  return text
    .replace(/\{name\}/g,     name)
    .replace(/\{business\}/g, biz)
    .replace(/\{industry\}/g, ind)
}

export default function OutreachPage() {
  const [leads, setLeads]         = useState<Lead[]>([])
  const [loading, setLoading]     = useState(true)
  const [showAll, setShowAll]     = useState(false)

  const [selected, setSelected]   = useState<Lead | null>(null)
  const [activeTemplate, setActiveTemplate] = useState(TEMPLATES[0])
  const [subject, setSubject]     = useState('')
  const [body, setBody]           = useState('')

  const [sending, setSending]     = useState(false)
  const [result, setResult]       = useState<{ ok: boolean; msg: string } | null>(null)

  const loadLeads = useCallback(async () => {
    setLoading(true)
    // Try assigned leads first; fall back to all if none
    const params = showAll ? '' : '?assigned_to=me'
    const res = await fetch(`/api/leads${params}`)
    const data = await res.json()
    const active = (Array.isArray(data) ? data : []).filter(
      (l: Lead) => !['closed_won', 'closed_lost'].includes(l.status)
    )
    setLeads(active)
    setLoading(false)
  }, [showAll])

  useEffect(() => { loadLeads() }, [loadLeads])

  const applyTemplate = (t: typeof TEMPLATES[0], lead: Lead | null) => {
    setActiveTemplate(t)
    if (lead) {
      setSubject(interpolate(t.subject, lead))
      setBody(interpolate(t.body, lead))
    } else {
      setSubject(t.subject)
      setBody(t.body)
    }
    setResult(null)
  }

  const selectLead = (lead: Lead) => {
    setSelected(lead)
    setSubject(interpolate(activeTemplate.subject, lead))
    setBody(interpolate(activeTemplate.body, lead))
    setResult(null)
  }

  const sendEmail = async () => {
    if (!selected?.contact_email || !subject || !body) return
    setSending(true)
    setResult(null)
    const res = await fetch('/api/leads/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id:       selected.id,
        to_email:      selected.contact_email,
        to_name:       selected.contact_name,
        business_name: selected.business_name,
        subject,
        body,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      if (data.sent) {
        setResult({ ok: true, msg: `Email delivered to ${selected.contact_email}.` })
      } else if (!data.configured) {
        setResult({ ok: false, msg: 'RESEND_API_KEY not configured — email logged but not sent.' })
      } else {
        setResult({ ok: false, msg: 'Email failed to deliver. Check Resend logs.' })
      }
      loadLeads()
    } else {
      setResult({ ok: false, msg: data.error || 'Request failed.' })
    }
    setSending(false)
  }

  const assignedCount = leads.filter(l => l.assigned_to).length
  const unassignedCount = leads.filter(l => !l.assigned_to).length

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/hub" className="text-gray-400 hover:text-gray-600 text-sm">← Hub</Link>
          <span className="text-gray-300">|</span>
          <h1 className="font-bold text-gray-800">Outreach Engine</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAll(!showAll)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition ${showAll ? 'bg-gray-100 border-gray-300 text-gray-700' : 'border-[#0F4C81] text-[#0F4C81]'}`}>
            {showAll ? 'All Leads' : 'My Assigned'}
          </button>
          <Link href="/hub/leads" className="text-sm text-[#0F4C81] hover:underline">CRM →</Link>
          <Link href="/admin/leads" className="text-xs text-gray-400 hover:text-gray-600">Assign Leads →</Link>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">

          {/* ── Left: Lead list ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                {showAll ? 'All Active Leads' : 'My Assigned Leads'}
              </p>
              {!showAll && leads.length === 0 && !loading && (
                <button onClick={() => setShowAll(true)} className="text-xs text-[#0F4C81] hover:underline">Show all</button>
              )}
            </div>

            {!showAll && (assignedCount > 0 || unassignedCount > 0) && (
              <p className="text-xs text-gray-400">
                {assignedCount} assigned · {unassignedCount} unassigned
              </p>
            )}

            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 animate-pulse h-14" />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                <p className="text-sm text-gray-500 mb-2">No leads assigned to you yet.</p>
                <p className="text-xs text-gray-400 mb-3">Ask an admin to assign leads, or switch to All Leads view.</p>
                <button onClick={() => setShowAll(true)}
                  className="text-xs text-[#0F4C81] font-semibold hover:underline">Show All Leads →</button>
              </div>
            ) : (
              <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
                {leads.map(lead => (
                  <button key={lead.id} onClick={() => selectLead(lead)}
                    className={`w-full text-left px-3 py-3 rounded-xl border text-sm transition ${
                      selected?.id === lead.id
                        ? 'border-[#0B2140] bg-[#0B2140]/5 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-[#0F4C81] hover:bg-blue-50/30'
                    }`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-gray-800 truncate text-sm">{lead.business_name}</p>
                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2 ${HEAT_STYLES[lead.heat] || 'bg-gray-100 text-gray-500'}`}>
                        {lead.heat}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{lead.contact_email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-400 capitalize">{lead.status?.replace('_', ' ')}</span>
                      {lead.assigned_to && (
                        <span className="text-xs text-green-600 font-medium">• assigned</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Composer ── */}
          <div className="space-y-4">
            {/* Template tabs */}
            <div className="flex gap-2 flex-wrap">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => applyTemplate(t, selected)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTemplate.id === t.id
                      ? 'bg-[#0B2140] text-white shadow-sm'
                      : 'border border-gray-200 text-gray-600 bg-white hover:border-[#0F4C81] hover:text-[#0F4C81]'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              {/* To line */}
              {selected && (
                <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 rounded-full bg-[#0B2140] text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {selected.business_name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{selected.business_name}</p>
                    <p className="text-xs text-gray-400">{selected.contact_email}</p>
                  </div>
                  <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${HEAT_STYLES[selected.heat] || ''}`}>
                    {selected.heat}
                  </span>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Subject</label>
                <input value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder="Select a lead to personalise"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Message</label>
                <textarea rows={14} value={body} onChange={e => setBody(e.target.value)}
                  placeholder="Select a lead on the left to load a personalised template..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81] resize-y font-mono" />
              </div>

              {result && (
                <div className={`rounded-lg px-4 py-3 text-sm font-medium ${result.ok ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                  {result.ok ? '✓ ' : '⚠ '}{result.msg}
                </div>
              )}

              <div className="flex gap-3 items-center">
                <button
                  onClick={sendEmail}
                  disabled={sending || !selected || !subject.trim() || !body.trim()}
                  className="flex-1 py-3 bg-[#0B2140] hover:bg-[#17377A] text-white rounded-xl font-bold text-sm disabled:opacity-40 transition">
                  {sending
                    ? 'Sending...'
                    : selected
                      ? `Send to ${selected.contact_email}`
                      : 'Select a lead first'}
                </button>
                {selected && (
                  <Link href={`/hub/leads`}
                    className="text-xs text-gray-400 hover:text-[#0F4C81] hover:underline whitespace-nowrap">
                    View in CRM →
                  </Link>
                )}
              </div>

              {!selected && (
                <p className="text-xs text-gray-400 text-center">
                  Select a lead on the left — the template will be personalised automatically
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
