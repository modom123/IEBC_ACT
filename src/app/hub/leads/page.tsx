'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Lead = {
  id: string
  business_name: string
  contact_email: string
  industry: string
  heat: 'hot' | 'warm' | 'cold'
  est_value: number
  status: 'new' | 'contacted' | 'qualified' | 'closed_won' | 'closed_lost'
  assigned_to: string | null
  assigned_to_name?: string | null
  created_at: string
}

type Activity = {
  id: string
  type: 'email_sent' | 'converted'
  subject: string
  metadata: Record<string, unknown>
  created_at: string
}

const HEAT_STYLES: Record<string, string> = {
  hot:  'bg-red-100 text-red-600',
  warm: 'bg-yellow-100 text-yellow-700',
  cold: 'bg-blue-100 text-blue-600',
}

const STATUS_STYLES: Record<string, string> = {
  new:         'bg-gray-100 text-gray-600',
  contacted:   'bg-blue-100 text-blue-700',
  qualified:   'bg-purple-100 text-purple-700',
  closed_won:  'bg-green-100 text-green-700',
  closed_lost: 'bg-red-100 text-red-400',
}

const PLAN_INFO = [
  { key: 'silver',   label: 'Silver',   price: '$9/mo',  desc: 'Core accounting + invoicing' },
  { key: 'gold',     label: 'Gold',     price: '$22/mo', desc: '+ Bank reconciliation & auto-rules' },
  { key: 'platinum', label: 'Platinum', price: '$42/mo', desc: '+ Payroll, inventory & purchase orders' },
]

const INDUSTRIES = ['Technology','Healthcare','Finance','Retail','Real Estate','Construction','Legal','Marketing','Manufacturing','Other']
const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US')

function defaultEmailBody(lead: Lead) {
  return `Hi there,

I wanted to follow up regarding your interest in Efficient by IEBC — our all-in-one financial infrastructure for small businesses.

We've helped businesses like ${lead.business_name} streamline their accounting, automate invoicing, and get real-time visibility into cash flow — all for as little as $9/month.

I'd love to show you a quick demo or answer any questions you might have. We also offer a 30-day free trial so you can explore with zero risk.

Would you be available for a quick 15-minute call this week?

Best,
IEBC Team
https://iebusinessconsultants.com`
}

export default function LeadsPage() {
  const [leads, setLeads]             = useState<Lead[]>([])
  const [loading, setLoading]         = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterHeat, setFilterHeat]   = useState('')
  const [filterMine, setFilterMine]   = useState(false)
  const [showForm, setShowForm]       = useState(false)
  const [saving, setSaving]           = useState(false)
  const [formError, setFormError]     = useState('')
  const [form, setForm] = useState({
    business_name: '', contact_email: '', industry: '', heat: 'warm', est_value: '', status: 'new',
  })

  // Email modal
  const [emailLead, setEmailLead]     = useState<Lead | null>(null)
  const [emailForm, setEmailForm]     = useState({ subject: '', body: '' })
  const [sending, setSending]         = useState(false)
  const [emailResult, setEmailResult] = useState<{ ok: boolean; msg: string } | null>(null)

  // Convert modal
  const [convertLead, setConvertLead]   = useState<Lead | null>(null)
  const [convertPlan, setConvertPlan]   = useState<'silver' | 'gold' | 'platinum'>('gold')
  const [converting, setConverting]     = useState(false)
  const [convertResult, setConvertResult] = useState<{ ok: boolean; msg: string; url?: string } | null>(null)

  // Activity drawer
  const [activityLead, setActivityLead] = useState<Lead | null>(null)
  const [activities, setActivities]     = useState<Activity[]>([])
  const [actLoading, setActLoading]     = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    if (filterHeat)   params.set('heat', filterHeat)
    if (filterMine)   params.set('assigned_to', 'me')
    const res = await fetch(`/api/leads?${params}`)
    const data = await res.json()
    setLeads(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterStatus, filterHeat, filterMine])

  useEffect(() => { load() }, [load])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ business_name: '', contact_email: '', industry: '', heat: 'warm', est_value: '', status: 'new' })
      load()
    } else {
      const d = await res.json()
      setFormError(d.error || 'Failed to save')
    }
    setSaving(false)
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    load()
  }

  const deleteLead = async (id: string) => {
    if (!confirm('Delete this lead?')) return
    await fetch(`/api/leads?id=${id}`, { method: 'DELETE' })
    load()
  }

  // ── Email modal ──────────────────────────────────────────────
  const openEmail = (lead: Lead) => {
    setEmailLead(lead)
    setEmailForm({
      subject: `Following up — Efficient Financial Suite for ${lead.business_name}`,
      body: defaultEmailBody(lead),
    })
    setEmailResult(null)
  }

  const sendEmail = async () => {
    if (!emailLead) return
    setSending(true)
    setEmailResult(null)
    const res = await fetch('/api/leads/outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: emailLead.id,
        to_email: emailLead.contact_email,
        business_name: emailLead.business_name,
        subject: emailForm.subject,
        body: emailForm.body,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      if (data.sent) {
        setEmailResult({ ok: true, msg: 'Email delivered successfully.' })
      } else if (!data.configured) {
        setEmailResult({ ok: false, msg: 'RESEND_API_KEY not set — email not sent, but activity logged.' })
      } else {
        setEmailResult({ ok: false, msg: 'Email failed to deliver. Check Resend logs.' })
      }
      load()
    } else {
      setEmailResult({ ok: false, msg: data.error || 'Request failed.' })
    }
    setSending(false)
  }

  // ── Convert modal ────────────────────────────────────────────
  const openConvert = (lead: Lead) => {
    setConvertLead(lead)
    setConvertPlan('gold')
    setConvertResult(null)
  }

  const sendConvert = async () => {
    if (!convertLead) return
    setConverting(true)
    setConvertResult(null)
    const res = await fetch('/api/leads/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: convertLead.id,
        plan: convertPlan,
        email: convertLead.contact_email,
        business_name: convertLead.business_name,
      }),
    })
    const data = await res.json()
    if (res.ok) {
      setConvertResult({
        ok: true,
        msg: data.email_sent
          ? 'Checkout link emailed + lead marked closed_won.'
          : 'Checkout link generated (email not sent — RESEND_API_KEY not set). Lead marked closed_won.',
        url: data.checkout_url,
      })
      load()
    } else {
      setConvertResult({ ok: false, msg: data.error || 'Request failed.' })
    }
    setConverting(false)
  }

  // ── Activity drawer ──────────────────────────────────────────
  const openActivity = async (lead: Lead) => {
    setActivityLead(lead)
    setActivities([])
    setActLoading(true)
    const res = await fetch(`/api/leads/outreach?lead_id=${lead.id}`)
    const data = await res.json()
    setActivities(data.activities || [])
    setActLoading(false)
  }

  const totalValue = leads.reduce((s, l) => s + Number(l.est_value), 0)
  const wonValue   = leads.filter(l => l.status === 'closed_won').reduce((s, l) => s + Number(l.est_value), 0)
  const hotCount   = leads.filter(l => l.heat === 'hot').length

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/hub" className="text-gray-400 hover:text-gray-600 text-sm">← Hub</Link>
          <span className="text-gray-300">|</span>
          <h1 className="font-bold text-gray-800">Lead Pipeline</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/leads" className="text-xs text-gray-400 hover:text-[#0F4C81] hover:underline">Assign Leads →</Link>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm">+ Add Lead</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-4">
        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Leads',     value: String(leads.length),  color: 'text-gray-800'  },
            { label: 'Hot Leads',       value: String(hotCount),      color: 'text-red-600'   },
            { label: 'Pipeline Value',  value: fmt(totalValue),       color: 'text-[#0F4C81]' },
            { label: 'Won',             value: fmt(wonValue),         color: 'text-green-600' },
          ].map((c, i) => (
            <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 text-center">
              <p className="text-xs text-gray-500 uppercase">{c.label}</p>
              <p className={`text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={() => setFilterMine(!filterMine)}
            className={`px-3 py-1 rounded-full text-xs font-bold transition border ${filterMine ? 'bg-[#0B2140] text-white border-[#0B2140]' : 'bg-white border-gray-300 text-gray-600 hover:border-[#0B2140]'}`}>
            {filterMine ? '★ My Leads' : '☆ My Leads'}
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div className="flex gap-1 flex-wrap">
            {['', 'new', 'contacted', 'qualified', 'closed_won', 'closed_lost'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${filterStatus === s ? 'bg-[#0F4C81] text-white' : 'bg-white border border-gray-200 hover:border-[#0F4C81]'}`}>
                {s === '' ? 'All Status' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div className="flex gap-1 ml-2">
            {['', 'hot', 'warm', 'cold'].map(h => (
              <button key={h} onClick={() => setFilterHeat(h)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${filterHeat === h ? 'bg-[#0F4C81] text-white' : 'bg-white border border-gray-200 hover:border-[#0F4C81]'}`}>
                {h === '' ? 'All Heat' : h}
              </button>
            ))}
          </div>
        </div>

        {/* Add Lead form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-[#0F4C81] p-6 shadow-sm">
            <h3 className="font-bold mb-4 text-[#0F4C81]">New Lead</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-600 block mb-1">Business Name</label>
                <input type="text" required value={form.business_name} onChange={e => setForm({...form, business_name: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Acme Corp" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Contact Email</label>
                <input type="email" value={form.contact_email} onChange={e => setForm({...form, contact_email: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="contact@acme.com" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Industry</label>
                <select value={form.industry} onChange={e => setForm({...form, industry: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select industry</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Heat</label>
                <select value={form.heat} onChange={e => setForm({...form, heat: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="hot">Hot</option>
                  <option value="warm">Warm</option>
                  <option value="cold">Cold</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Est. Value ($)</label>
                <input type="number" min="0" step="100" value={form.est_value} onChange={e => setForm({...form, est_value: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="5000" />
              </div>
              {formError && <p className="col-span-full text-red-600 text-sm">{formError}</p>}
              <div className="col-span-full flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Saving...' : 'Save Lead'}</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Leads table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 mb-3">No leads yet</p>
              <button onClick={() => setShowForm(true)} className="btn-primary text-sm">Add First Lead</button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
                  <th className="p-3 text-left">Business</th>
                  <th className="p-3 text-left hidden md:table-cell">Industry</th>
                  <th className="p-3 text-left">Heat</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left hidden lg:table-cell">Assigned</th>
                  <th className="p-3 text-right">Est. Value</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <p className="font-medium">{lead.business_name}</p>
                      {lead.contact_email && <p className="text-xs text-gray-400">{lead.contact_email}</p>}
                    </td>
                    <td className="p-3 text-gray-500 hidden md:table-cell">{lead.industry || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${HEAT_STYLES[lead.heat]}`}>{lead.heat}</span>
                    </td>
                    <td className="p-3">
                      <select value={lead.status} onChange={e => updateStatus(lead.id, e.target.value)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border-0 cursor-pointer ${STATUS_STYLES[lead.status]}`}>
                        {['new', 'contacted', 'qualified', 'closed_won', 'closed_lost'].map(s => (
                          <option key={s} value={s}>{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      {lead.assigned_to ? (
                        <span className="text-xs text-green-700 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                          {lead.assigned_to_name || 'Assigned'}
                        </span>
                      ) : (
                        <span className="text-xs text-orange-500 font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono font-semibold">{fmt(lead.est_value)}</td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {lead.contact_email && lead.status !== 'closed_won' && lead.status !== 'closed_lost' && (
                          <button onClick={() => openEmail(lead)}
                            className="px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
                            Email
                          </button>
                        )}
                        {lead.contact_email && lead.status !== 'closed_won' && lead.status !== 'closed_lost' && (
                          <button onClick={() => openConvert(lead)}
                            className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition">
                            Convert
                          </button>
                        )}
                        <button onClick={() => openActivity(lead)}
                          className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                          Log
                        </button>
                        <button onClick={() => deleteLead(lead.id)}
                          className="px-2 py-1 rounded text-xs font-medium text-red-400 hover:text-red-600 hover:bg-red-50 transition">
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Email modal ──────────────────────────────────────────── */}
      {emailLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !sending && setEmailLead(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-800">Send Outreach Email</h2>
                <p className="text-xs text-gray-400 mt-0.5">To: {emailLead.contact_email} · {emailLead.business_name}</p>
              </div>
              <button onClick={() => setEmailLead(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Subject</label>
                <input type="text" value={emailForm.subject} onChange={e => setEmailForm({...emailForm, subject: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#0F4C81]" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Message</label>
                <textarea rows={12} value={emailForm.body} onChange={e => setEmailForm({...emailForm, body: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#0F4C81] resize-y" />
              </div>

              {emailResult && (
                <div className={`rounded-lg px-4 py-3 text-sm font-medium ${emailResult.ok ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                  {emailResult.ok ? '✓ ' : '⚠ '}{emailResult.msg}
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button onClick={() => setEmailLead(null)} className="btn-secondary text-sm">Close</button>
                <button onClick={sendEmail} disabled={sending || !emailForm.subject || !emailForm.body}
                  className="btn-primary text-sm min-w-[120px]">
                  {sending ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Convert modal ───────────────────────────────────────── */}
      {convertLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !converting && setConvertLead(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-bold text-gray-800">Convert to Subscriber</h2>
                <p className="text-xs text-gray-400 mt-0.5">{convertLead.business_name} · {convertLead.contact_email}</p>
              </div>
              <button onClick={() => setConvertLead(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Select a plan. We&apos;ll generate a personalised Stripe checkout link (30-day free trial) and email it directly to the lead.
              </p>

              {/* Plan cards */}
              <div className="space-y-2">
                {PLAN_INFO.map(p => (
                  <button key={p.key} onClick={() => setConvertPlan(p.key as 'silver' | 'gold' | 'platinum')}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition ${
                      convertPlan === p.key
                        ? 'border-[#0B2140] bg-[#0B2140]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold text-gray-800">{p.label}</span>
                        <span className="text-xs text-gray-500 ml-2">{p.desc}</span>
                      </div>
                      <span className="font-bold text-[#0F4C81]">{p.price}</span>
                    </div>
                  </button>
                ))}
              </div>

              {convertResult && (
                <div className={`rounded-lg px-4 py-3 text-sm ${convertResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <p className="font-medium">{convertResult.ok ? '✓ ' : '✗ '}{convertResult.msg}</p>
                  {convertResult.url && (
                    <div className="mt-2">
                      <p className="text-xs text-green-600 font-semibold mb-1">Checkout link:</p>
                      <input readOnly value={convertResult.url}
                        className="w-full text-xs bg-white border border-green-200 rounded px-2 py-1 font-mono text-green-800"
                        onFocus={e => e.target.select()} />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button onClick={() => setConvertLead(null)} className="btn-secondary text-sm">Close</button>
                {!convertResult?.ok && (
                  <button onClick={sendConvert} disabled={converting}
                    className="btn-primary text-sm min-w-[160px]">
                    {converting ? 'Sending...' : 'Send Checkout Link'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Activity drawer ─────────────────────────────────────── */}
      {activityLead && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4" onClick={() => setActivityLead(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <div>
                <h2 className="font-bold text-gray-800">Activity Log</h2>
                <p className="text-xs text-gray-400 mt-0.5">{activityLead.business_name}</p>
              </div>
              <button onClick={() => setActivityLead(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>
            <div className="p-6">
              {actLoading ? (
                <p className="text-sm text-gray-400 text-center py-6">Loading...</p>
              ) : activities.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No activity yet for this lead.</p>
              ) : (
                <div className="space-y-3">
                  {activities.map(a => (
                    <div key={a.id} className="border border-gray-100 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          a.type === 'converted' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {a.type === 'converted' ? 'Converted' : 'Email Sent'}
                        </span>
                        <span className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-700">{a.subject}</p>
                      {(a.metadata?.sent as boolean) === false && (
                        <p className="text-xs text-yellow-600 mt-1">⚠ Email not delivered (Resend not configured)</p>
                      )}
                      {a.type === 'converted' && !!a.metadata?.checkout_url && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          Link: {String(a.metadata.checkout_url as string)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
