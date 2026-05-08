'use client'

import { useState, useEffect, useCallback } from 'react'
import AccountingShell from '@/components/AccountingShell'

type TaxObligation = {
  id: string
  name: string
  type: string
  amount: number
  due_date: string
  period_start: string | null
  period_end: string | null
  status: 'pending' | 'paid' | 'overdue'
  notes: string | null
}

const TAX_TYPES = ['federal_income', 'state_income', 'self_employment', 'sales_tax', 'payroll_tax', 'estimated_quarterly', 'franchise', 'property', 'other']
const TYPE_LABELS: Record<string, string> = {
  federal_income: 'Federal Income', state_income: 'State Income', self_employment: 'Self-Employment',
  sales_tax: 'Sales Tax', payroll_tax: 'Payroll Tax', estimated_quarterly: 'Estimated Quarterly',
  franchise: 'Franchise Tax', property: 'Property Tax', other: 'Other',
}
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  paid:    'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
}

const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const today = () => new Date().toISOString().split('T')[0]

const emptyForm = { name: '', type: 'estimated_quarterly', amount: '', due_date: '', period_start: '', period_end: '', notes: '' }

export default function TaxCenterPage() {
  const [obligations, setObligations] = useState<TaxObligation[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [form, setForm]       = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/accounting/tax')
      const data = await res.json()
      const todayStr = today()
      const items = (Array.isArray(data) ? data : []).map((o: TaxObligation) => ({
        ...o,
        status: o.status === 'paid' ? 'paid' : o.due_date < todayStr ? 'overdue' : 'pending',
      }))
      setObligations(items)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function addObligation(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.amount || !form.due_date) { setError('Name, amount, and due date are required.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/accounting/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      await load()
      setForm(emptyForm); setShowAdd(false)
    } finally { setSaving(false) }
  }

  async function markPaid(id: string) {
    setObligations(prev => prev.map(o => o.id === id ? { ...o, status: 'paid' } : o))
    await fetch('/api/accounting/tax', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'paid' }),
    })
  }

  async function remove(id: string) {
    if (!confirm('Delete this tax obligation?')) return
    const p = new URLSearchParams({ id })
    await fetch(`/api/accounting/tax?${p}`, { method: 'DELETE' })
    setObligations(prev => prev.filter(o => o.id !== id))
  }

  const todayStr = today()
  const filtered = obligations.filter(o => filterStatus === 'all' || o.status === filterStatus)
  const totalOwed    = obligations.filter(o => o.status !== 'paid').reduce((s, o) => s + Number(o.amount), 0)
  const totalOverdue = obligations.filter(o => o.status === 'overdue').reduce((s, o) => s + Number(o.amount), 0)
  const totalPaid    = obligations.filter(o => o.status === 'paid').reduce((s, o) => s + Number(o.amount), 0)
  const nextDue      = obligations.filter(o => o.status === 'pending').sort((a, b) => a.due_date.localeCompare(b.due_date))[0]

  // Estimated quarterly schedule
  const QE_DATES = [
    { period: 'Q1 (Jan–Mar)', due: `${new Date().getFullYear()}-04-15` },
    { period: 'Q2 (Apr–May)', due: `${new Date().getFullYear()}-06-17` },
    { period: 'Q3 (Jun–Aug)', due: `${new Date().getFullYear()}-09-16` },
    { period: 'Q4 (Sep–Dec)', due: `${new Date().getFullYear() + 1}-01-15` },
  ]

  return (
    <AccountingShell>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tax Center</h1>
            <p className="text-sm text-gray-400 mt-0.5">Track tax obligations, estimated payments, and filing deadlines</p>
          </div>
          <button onClick={() => setShowAdd(v => !v)}
            className="px-4 py-2 bg-[#0F4C81] hover:bg-[#082D4F] text-white text-sm font-semibold rounded-lg transition">
            + Add Obligation
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Owed',      value: fmt(totalOwed),    color: totalOwed > 0 ? 'text-red-600' : 'text-gray-400' },
            { label: 'Overdue',         value: fmt(totalOverdue), color: totalOverdue > 0 ? 'text-red-600' : 'text-gray-400' },
            { label: 'Paid YTD',        value: fmt(totalPaid),    color: 'text-green-700' },
            { label: 'Next Due',        value: nextDue ? new Date(nextDue.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'None', color: 'text-[#0F4C81]' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
              {c.label === 'Next Due' && nextDue && <p className="text-xs text-gray-400 mt-0.5 truncate">{nextDue.name}</p>}
            </div>
          ))}
        </div>

        {/* Overdue Alert */}
        {totalOverdue > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            🚨 <strong>{fmt(totalOverdue)}</strong> in overdue tax obligations. File and pay immediately to avoid penalties and interest.
          </div>
        )}

        {/* Add Form */}
        {showAdd && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-4">New Tax Obligation</h2>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <form onSubmit={addObligation} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Q1 Estimated Tax" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]">
                  {TAX_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Amount *</label>
                <input type="number" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Due Date *</label>
                <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Period Start</label>
                <input type="date" value={form.period_start} onChange={e => setForm(p => ({ ...p, period_start: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Period End</label>
                <input type="date" value={form.period_end} onChange={e => setForm(p => ({ ...p, period_end: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div className="flex items-end gap-2">
                <button type="submit" disabled={saving} className="flex-1 py-2 bg-[#0F4C81] hover:bg-[#082D4F] text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                  {saving ? 'Saving…' : 'Add Obligation'}
                </button>
                <button type="button" onClick={() => { setShowAdd(false); setForm(emptyForm) }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {['all', 'pending', 'overdue', 'paid'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${filterStatus === s ? 'bg-[#0F4C81] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#0F4C81]'}`}>
              {s === 'all' ? `All (${obligations.length})` : `${s.charAt(0).toUpperCase() + s.slice(1)} (${obligations.filter(o => o.status === s).length})`}
            </button>
          ))}
        </div>

        {/* Obligations Table */}
        {!loading && obligations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">💸</span>
            </div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">No tax obligations</h3>
            <p className="text-gray-400 text-sm mb-6">Add estimated quarterly taxes, sales tax, payroll taxes, and other filing deadlines.</p>
            <button onClick={() => setShowAdd(true)} className="px-5 py-2 bg-[#0F4C81] text-white text-sm font-semibold rounded-lg hover:bg-[#082D4F] transition">+ Add First Obligation</button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="px-4 py-3 text-left font-medium">Obligation</th>
                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Type</th>
                    <th className="px-4 py-3 text-left font-medium">Due Date</th>
                    <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Period</th>
                    <th className="px-4 py-3 text-center font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-center font-medium w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{o.name}</p>
                        {o.notes && <p className="text-xs text-gray-400 truncate max-w-[180px]">{o.notes}</p>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500">{TYPE_LABELS[o.type] || o.type}</span>
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${o.status === 'overdue' ? 'text-red-600' : 'text-gray-700'}`}>
                        {new Date(o.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {o.status === 'overdue' && <span className="ml-1 text-xs text-red-500">OVERDUE</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                        {o.period_start && o.period_end ? `${o.period_start} – ${o.period_end}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[o.status]}`}>{o.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-gray-800">{fmt(o.amount)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {o.status !== 'paid' && (
                            <button onClick={() => markPaid(o.id)} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 font-medium transition">Paid</button>
                          )}
                          <button onClick={() => remove(o.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={5} className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">Total Unpaid</td>
                    <td className="px-4 py-2.5 text-right font-bold text-sm text-red-600">{fmt(filtered.filter(o => o.status !== 'paid').reduce((s, o) => s + Number(o.amount), 0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Quarterly Estimated Tax Schedule */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-1">Estimated Quarterly Tax Schedule</h2>
          <p className="text-xs text-gray-400 mb-4">IRS Form 1040-ES deadlines for self-employed individuals and pass-through entities</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {QE_DATES.map(q => {
              const isPast = q.due < todayStr
              const isNext = !isPast && QE_DATES.filter(d => d.due >= todayStr)[0]?.due === q.due
              return (
                <div key={q.period} className={`rounded-lg p-3 border text-sm ${isPast ? 'bg-gray-50 border-gray-100 opacity-60' : isNext ? 'bg-blue-50 border-[#0F4C81]' : 'bg-white border-gray-200'}`}>
                  <p className="font-semibold text-gray-800 text-xs">{q.period}</p>
                  <p className={`text-sm font-bold mt-1 ${isNext ? 'text-[#0F4C81]' : 'text-gray-600'}`}>
                    {new Date(q.due + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  {isNext && <span className="text-[10px] text-[#0F4C81] font-bold uppercase tracking-wide">Next Due</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AccountingShell>
  )
}
