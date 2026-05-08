'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type LineItem = {
  description: string
  qty: string
  rate: string
  amount: number
}

type Estimate = {
  id: string
  estimate_number: string
  client_name: string
  client_email: string
  items: LineItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired'
  valid_until: string
  notes: string
  converted_invoice_id: string | null
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  declined: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
}

const TABS = ['All', 'Draft', 'Sent', 'Accepted', 'Declined', 'Expired'] as const

const fmt = (n: number) =>
  '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const emptyItem = (): LineItem => ({ description: '', qty: '', rate: '', amount: 0 })

export default function EstimatesPage() {
  const [estimates, setEstimates] = useState<Estimate[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<string>('All')
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [convertedInvoiceId, setConvertedInvoiceId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    valid_until: '',
    tax_rate: '0',
    notes: '',
    items: [emptyItem()],
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/accounting/estimates')
      const data = await res.json()
      setEstimates(Array.isArray(data) ? data : [])
    } catch {
      setError('Failed to load estimates')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const tabCounts = {
    All: estimates.length,
    Draft: estimates.filter(e => e.status === 'draft').length,
    Sent: estimates.filter(e => e.status === 'sent').length,
    Accepted: estimates.filter(e => e.status === 'accepted').length,
    Declined: estimates.filter(e => e.status === 'declined').length,
    Expired: estimates.filter(e => e.status === 'expired').length,
  }

  const filtered = tab === 'All' ? estimates : estimates.filter(e => e.status === tab.toLowerCase())

  const accepted = estimates.filter(e => e.status === 'accepted')
  const pending = estimates.filter(e => e.status === 'draft' || e.status === 'sent')
  const conversionRate = estimates.length > 0 ? Math.round((accepted.length / estimates.length) * 100) : 0

  const calcItems = (items: LineItem[], taxRate: string) => {
    const updated = items.map(it => ({
      ...it,
      amount: parseFloat(it.qty || '0') * parseFloat(it.rate || '0'),
    }))
    const subtotal = updated.reduce((s, it) => s + it.amount, 0)
    const rate = parseFloat(taxRate || '0')
    const taxAmount = subtotal * (rate / 100)
    const total = subtotal + taxAmount
    return { updated, subtotal, taxAmount, total }
  }

  const { subtotal, taxAmount, total } = calcItems(form.items, form.tax_rate)

  const updateItem = (idx: number, field: keyof LineItem, value: string) => {
    setForm(prev => {
      const items = prev.items.map((it, i) =>
        i === idx ? { ...it, [field]: value } : it
      )
      return { ...prev, items }
    })
  }

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, emptyItem()] }))

  const removeItem = (idx: number) =>
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_name.trim()) { setError('Client name is required'); return }
    setSaving(true)
    setError(null)
    try {
      const { updated, subtotal, taxAmount, total } = calcItems(form.items, form.tax_rate)
      const taxRate = parseFloat(form.tax_rate || '0')
      const body = {
        client_name: form.client_name,
        client_email: form.client_email,
        valid_until: form.valid_until || null,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        subtotal,
        total,
        notes: form.notes,
        items: updated,
        status: 'draft',
      }
      const res = await fetch('/api/accounting/estimates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      setShowForm(false)
      setForm({ client_name: '', client_email: '', valid_until: '', tax_rate: '0', notes: '', items: [emptyItem()] })
      setSuccessMsg('Estimate created successfully')
      setTimeout(() => setSuccessMsg(null), 4000)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create estimate')
    } finally {
      setSaving(false)
    }
  }

  const handleSend = async (id: string) => {
    setActionLoading(id + '-send')
    setError(null)
    try {
      const res = await fetch(`/api/accounting/estimates?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send estimate')
    } finally {
      setActionLoading(null)
    }
  }

  const handleConvert = async (id: string) => {
    setActionLoading(id + '-convert')
    setError(null)
    try {
      const res = await fetch(`/api/accounting/estimates?id=${id}`, {
        method: 'PUT',
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setConvertedInvoiceId(data?.invoice_id ?? null)
      setSuccessMsg('Estimate converted to invoice!')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert estimate')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this estimate?')) return
    setActionLoading(id + '-delete')
    setError(null)
    try {
      const res = await fetch(`/api/accounting/estimates?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete estimate')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage client estimates</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError(null) }}
          className="bg-[#0F4C81] hover:bg-[#082D4F] text-white px-4 py-2 rounded-xl text-sm font-semibold transition shadow-sm"
        >
          {showForm ? '✕ Cancel' : '+ New Estimate'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <span>⚠</span> {error}
          <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <span>✓</span> {successMsg}
          {convertedInvoiceId && (
            <Link href="/accounting/invoices" className="underline font-semibold ml-1">View Invoices →</Link>
          )}
          <button className="ml-auto text-green-400 hover:text-green-600" onClick={() => { setSuccessMsg(null); setConvertedInvoiceId(null) }}>✕</button>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Estimates</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{estimates.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Accepted</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{accepted.length}</p>
          <p className="text-xs text-gray-400 mt-1">{fmt(accepted.reduce((s, e) => s + e.total, 0))}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Pending</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{pending.length}</p>
          <p className="text-xs text-gray-400 mt-1">Draft + Sent</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Conversion Rate</p>
          <p className="text-3xl font-bold text-[#0F4C81] mt-1">{conversionRate}%</p>
          <p className="text-xs text-gray-400 mt-1">Accepted / Total</p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
          <h2 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-3">New Estimate</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Client Name *</label>
              <input
                required
                value={form.client_name}
                onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
                placeholder="Client name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Client Email</label>
              <input
                type="email"
                value={form.client_email}
                onChange={e => setForm(p => ({ ...p, client_email: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
                placeholder="client@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Valid Until</label>
              <input
                type="date"
                value={form.valid_until}
                onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Tax Rate (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.tax_rate}
                onChange={e => setForm(p => ({ ...p, tax_rate: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 focus:border-[#0F4C81] resize-none"
              placeholder="Additional notes..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-600">Line Items</label>
              <button type="button" onClick={addItem} className="text-xs text-[#0F4C81] hover:underline font-semibold">+ Add Row</button>
            </div>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 font-semibold">
                    <th className="text-left px-3 py-2.5 w-1/2">Description</th>
                    <th className="text-right px-3 py-2.5 w-16">Qty</th>
                    <th className="text-right px-3 py-2.5 w-24">Rate</th>
                    <th className="text-right px-3 py-2.5 w-24">Amount</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {form.items.map((item, idx) => {
                    const amt = parseFloat(item.qty || '0') * parseFloat(item.rate || '0')
                    return (
                      <tr key={idx}>
                        <td className="px-2 py-1.5">
                          <input
                            value={item.description}
                            onChange={e => updateItem(idx, 'description', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0F4C81]/30"
                            placeholder="Description"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.qty}
                            onChange={e => updateItem(idx, 'qty', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#0F4C81]/30"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.rate}
                            onChange={e => updateItem(idx, 'rate', e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#0F4C81]/30"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-700 font-medium whitespace-nowrap">
                          {fmt(amt)}
                        </td>
                        <td className="px-2 py-1.5">
                          {form.items.length > 1 && (
                            <button type="button" onClick={() => removeItem(idx)} className="text-gray-300 hover:text-red-400 transition text-lg leading-none">✕</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex justify-end">
              <div className="w-64 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-medium">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Tax ({form.tax_rate || 0}%)</span>
                  <span className="font-medium">{fmt(taxAmount)}</span>
                </div>
                <div className="flex justify-between text-gray-900 font-bold text-base border-t border-gray-100 pt-1.5">
                  <span>Total</span>
                  <span>{fmt(total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-[#0F4C81] hover:bg-[#082D4F] text-white px-6 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Estimate'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null) }}
              className="border border-gray-200 text-gray-600 hover:bg-gray-50 px-6 py-2 rounded-xl text-sm font-semibold transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 px-4 flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-3 text-sm font-semibold whitespace-nowrap transition border-b-2 ${
                tab === t
                  ? 'border-[#0F4C81] text-[#0F4C81]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                tab === t ? 'bg-[#0F4C81] text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                {tabCounts[t as keyof typeof tabCounts]}
              </span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm">Loading estimates…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            No estimates found{tab !== 'All' && ` in ${tab}`}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 font-semibold">
                  <th className="text-left px-4 py-3">Estimate #</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Created</th>
                  <th className="text-left px-4 py-3">Valid Until</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(est => (
                  <tr key={est.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[#0F4C81] font-semibold">
                      {est.estimate_number}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{est.client_name}</div>
                      {est.client_email && <div className="text-xs text-gray-400">{est.client_email}</div>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {est.created_at ? new Date(est.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {est.valid_until ? new Date(est.valid_until).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {fmt(est.total)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_STYLES[est.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {est.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {est.status === 'draft' && (
                          <button
                            onClick={() => handleSend(est.id)}
                            disabled={actionLoading === est.id + '-send'}
                            className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold transition disabled:opacity-50"
                          >
                            {actionLoading === est.id + '-send' ? '…' : 'Send'}
                          </button>
                        )}
                        {(est.status === 'accepted' || est.status === 'sent') && !est.converted_invoice_id && (
                          <button
                            onClick={() => handleConvert(est.id)}
                            disabled={actionLoading === est.id + '-convert'}
                            className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-semibold transition disabled:opacity-50 whitespace-nowrap"
                          >
                            {actionLoading === est.id + '-convert' ? '…' : '→ Invoice'}
                          </button>
                        )}
                        {est.converted_invoice_id && (
                          <Link href="/accounting/invoices" className="text-xs px-2.5 py-1 rounded-lg bg-gray-50 text-gray-500 font-semibold">
                            Invoiced
                          </Link>
                        )}
                        <button
                          onClick={() => handleDelete(est.id)}
                          disabled={actionLoading === est.id + '-delete'}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 font-semibold transition disabled:opacity-50"
                        >
                          {actionLoading === est.id + '-delete' ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
