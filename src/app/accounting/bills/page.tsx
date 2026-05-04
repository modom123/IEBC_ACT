'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { EXPENSE_CATEGORIES } from '@/lib/categories'

type Bill = {
  id: string
  vendor_name: string
  description: string
  amount: number
  due_date: string
  status: 'unpaid' | 'paid' | 'overdue' | 'void'
  category: string
  reference: string
  paid_date?: string
}

const EMPTY_FORM = { vendor_name: '', description: '', amount: '', due_date: '', category: '', reference: '' }
const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent placeholder:text-gray-400 transition-all min-h-[44px]'

const STATUS_COLORS: Record<string, string> = {
  unpaid:  'bg-yellow-100 text-yellow-800',
  paid:    'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  void:    'bg-gray-100 text-gray-500',
}

function TableSkeleton() {
  return (
    <div className="p-6 space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-20 shrink-0" />
          <div className="h-4 bg-gray-200 rounded flex-1" />
          <div className="h-4 bg-gray-200 rounded w-24 shrink-0" />
          <div className="h-4 bg-gray-200 rounded w-20 shrink-0" />
        </div>
      ))}
    </div>
  )
}

export default function BillsPage() {
  const [bills, setBills]             = useState<Bill[]>([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [form, setForm]               = useState({ ...EMPTY_FORM, due_date: new Date().toISOString().split('T')[0] })
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [editForm, setEditForm]       = useState<typeof EMPTY_FORM & { due_date: string; status: string }>({ ...EMPTY_FORM, due_date: '', status: 'unpaid' })
  const [editSaving, setEditSaving]   = useState(false)
  const [editError, setEditError]     = useState('')

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus) params.set('status', filterStatus)
    const qs = params.toString()
    const res = await fetch(`/api/accounting/bills${qs ? '?' + qs : ''}`)
    const data = await res.json()
    setBills(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filterStatus])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    const tempId = 'temp-' + Date.now()
    const optimistic: Bill = {
      id: tempId,
      vendor_name: form.vendor_name,
      description: form.description,
      amount: parseFloat(form.amount),
      due_date: form.due_date,
      status: 'unpaid',
      category: form.category,
      reference: form.reference,
    }
    setBills(prev => [optimistic, ...prev])
    setShowForm(false)
    setForm({ ...EMPTY_FORM, due_date: new Date().toISOString().split('T')[0] })
    const res = await fetch('/api/accounting/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const saved = await res.json()
      setBills(prev => prev.map(b => b.id === tempId ? saved : b))
    } else {
      const d = await res.json()
      setBills(prev => prev.filter(b => b.id !== tempId))
      setShowForm(true)
      setError(d.error || 'Failed to save')
    }
    setSaving(false)
  }

  const startEdit = (b: Bill) => {
    setEditingId(b.id)
    setEditForm({
      vendor_name: b.vendor_name,
      description: b.description || '',
      amount: String(b.amount),
      due_date: b.due_date,
      category: b.category || '',
      reference: b.reference || '',
      status: b.status,
    })
    setEditError('')
  }

  const cancelEdit = () => { setEditingId(null); setEditError('') }

  const handleEditSave = async (id: string) => {
    setEditSaving(true); setEditError('')
    const updated = { ...editForm, amount: parseFloat(editForm.amount) }
    const prev = bills
    setBills(bs => bs.map(b => b.id === id ? { ...b, ...updated } as Bill : b))
    setEditingId(null)
    const res = await fetch('/api/accounting/bills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updated }),
    })
    if (!res.ok) {
      const d = await res.json()
      setBills(prev)
      setEditingId(id)
      setEditError(d.error || 'Failed to update')
    }
    setEditSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bill?')) return
    const prev = bills
    setBills(bs => bs.filter(b => b.id !== id))
    const res = await fetch(`/api/accounting/bills?id=${id}`, { method: 'DELETE' })
    if (!res.ok) setBills(prev)
  }

  const markPaid = async (id: string) => {
    const prev = bills
    const today = new Date().toISOString().split('T')[0]
    setBills(bs => bs.map(b => b.id === id ? { ...b, status: 'paid', paid_date: today } : b))
    const res = await fetch('/api/accounting/bills', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'paid', paid_date: today }),
    })
    if (!res.ok) setBills(prev)
  }

  const today = new Date().toISOString().split('T')[0]
  const totalUnpaid  = bills.filter(b => b.status === 'unpaid' || b.status === 'overdue').reduce((s, b) => s + Number(b.amount), 0)
  const totalPaid    = bills.filter(b => b.status === 'paid').reduce((s, b) => s + Number(b.amount), 0)
  const overdueCount = bills.filter(b => b.status === 'unpaid' && b.due_date < today).length
  const grandTotal   = bills.filter(b => b.status !== 'void').reduce((s, b) => s + Number(b.amount), 0)

  // Running total sorted by due_date ascending
  const sorted = [...bills].sort((a, b) => a.due_date.localeCompare(b.due_date))
  let running = 0
  const billsWithRunning = sorted.map(b => {
    if (b.status !== 'void') running += Number(b.amount)
    return { ...b, running }
  })

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/accounting" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <span className="text-gray-300" aria-hidden="true">|</span>
          <h1 className="font-bold text-gray-800">Bills &amp; Payables</h1>
        </div>
        <div className="flex gap-2">
          <a href="/api/export?type=bills" className="btn-secondary text-sm py-2">Export CSV</a>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm">+ Add Bill</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-4">

        {/* KPI Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" role="region" aria-label="Bills summary">
          <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Unpaid / Overdue</p>
            <p className="text-xl font-bold text-red-600 mt-1">{fmt(totalUnpaid)}</p>
            {overdueCount > 0 && <p className="text-xs text-orange-500 mt-0.5">{overdueCount} past due</p>}
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Paid</p>
            <p className="text-xl font-bold text-green-600 mt-1">{fmt(totalPaid)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Overdue Bills</p>
            <p className={`text-xl font-bold mt-1 ${overdueCount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{overdueCount}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border-2 border-gray-300 text-center">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Grand Total (All)</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{fmt(grandTotal)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label="Filter bills">
          {(['', 'unpaid', 'paid', 'overdue', 'void'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              aria-pressed={filterStatus === s}
              className={`px-4 py-2 rounded-full text-sm font-medium transition min-h-[36px] ${filterStatus === s ? 'bg-[#0F4C81] text-white' : 'bg-white border border-gray-200 hover:border-[#0F4C81] text-gray-600'}`}>
              {s === '' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Add Form */}
        {showForm && (
          <section className="bg-white rounded-xl border border-[#0F4C81] p-6 shadow-sm space-y-5" aria-label="New bill form">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#0F4C81]">New Bill</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close form"
                className="text-gray-400 hover:text-gray-600 text-lg w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition">
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Vendor Name</label>
                <input required value={form.vendor_name} onChange={e => setForm({ ...form, vendor_name: e.target.value })}
                  placeholder="Vendor or company" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Amount ($)</label>
                <input type="number" step="0.01" min="0" required value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Due Date</label>
                <input type="date" required value={form.due_date}
                  onChange={e => setForm({ ...form, due_date: e.target.value })} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Description</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="What is this bill for?" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls}>
                  <option value="">Select category</option>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Reference #</label>
                <input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })}
                  placeholder="Invoice #, PO #" className={inputCls} />
              </div>

              {error && (
                <p role="alert" className="col-span-full text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="col-span-full flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary text-sm">
                  {saving ? 'Saving…' : 'Save Bill'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          </section>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <TableSkeleton />
          ) : billsWithRunning.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                <span className="text-3xl">🧾</span>
              </div>
              <p className="font-semibold text-gray-700 mb-1">
                {filterStatus ? `No ${filterStatus} bills` : 'No bills yet'}
              </p>
              <p className="text-sm text-gray-400 mb-5">Add your first bill to start tracking payables.</p>
              <button onClick={() => setShowForm(true)} className="btn-primary text-sm">Add Bill</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
                    <th className="p-3 text-left">Due Date</th>
                    <th className="p-3 text-left">Vendor</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-left">Ref #</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">Running Total</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {billsWithRunning.map(b => {
                    const isTemp    = b.id.startsWith('temp-')
                    const isOverdue = b.status === 'unpaid' && b.due_date < today

                    if (editingId === b.id) {
                      return (
                        <tr key={b.id} className="bg-blue-50">
                          <td className="p-2">
                            <input type="date" value={editForm.due_date} onChange={e => setEditForm({ ...editForm, due_date: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                          </td>
                          <td className="p-2">
                            <input value={editForm.vendor_name} onChange={e => setEditForm({ ...editForm, vendor_name: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                          </td>
                          <td className="p-2">
                            <input value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                          </td>
                          <td className="p-2">
                            <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs">
                              <option value="">Uncategorized</option>
                              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="p-2">
                            <input value={editForm.reference} onChange={e => setEditForm({ ...editForm, reference: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                          </td>
                          <td className="p-2">
                            <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                              className="border border-gray-300 rounded px-2 py-1 text-xs">
                              <option value="unpaid">Unpaid</option>
                              <option value="paid">Paid</option>
                              <option value="overdue">Overdue</option>
                              <option value="void">Void</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input type="number" step="0.01" value={editForm.amount}
                              onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                              className="border border-gray-300 rounded px-2 py-1 text-xs w-24 text-right" />
                          </td>
                          <td className="p-2 text-right text-xs text-gray-400">—</td>
                          <td className="p-2 text-center">
                            {editError && <p className="text-red-500 text-xs mb-1">{editError}</p>}
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => handleEditSave(b.id)} disabled={editSaving}
                                className="px-2 py-1 bg-[#0F4C81] text-white rounded text-xs hover:bg-[#0a3a66] disabled:opacity-50">
                                {editSaving ? '…' : 'Save'}
                              </button>
                              <button onClick={cancelEdit} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200">Cancel</button>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <tr key={b.id} className={`hover:bg-gray-50 transition-opacity ${isTemp ? 'opacity-60' : ''} ${isOverdue ? 'bg-red-50' : ''}`}>
                        <td className={`p-3 whitespace-nowrap ${isOverdue ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                          {b.due_date}{isOverdue && ' ⚠'}
                        </td>
                        <td className="p-3 font-medium">{b.vendor_name}</td>
                        <td className="p-3 text-gray-500">{b.description || '—'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{b.category || 'Uncategorized'}</span>
                        </td>
                        <td className="p-3 text-gray-400 text-xs">{b.reference || '—'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.status] || ''}`}>
                            {b.status}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-semibold text-red-600">{fmt(b.amount)}</td>
                        <td className="p-3 text-right font-mono text-gray-500 text-xs">{fmt(b.running)}</td>
                        <td className="p-3 text-center">
                          <div className="flex gap-2 justify-center items-center">
                            {(b.status === 'unpaid' || b.status === 'overdue') && (
                              <button onClick={() => markPaid(b.id)} disabled={isTemp}
                                className="text-green-600 hover:text-green-800 text-xs font-medium disabled:opacity-40">
                                ✓ Paid
                              </button>
                            )}
                            <button onClick={() => startEdit(b)} disabled={isTemp}
                              className="text-[#0F4C81] hover:text-[#0a3a66] text-xs disabled:opacity-40">
                              Edit
                            </button>
                            <button onClick={() => handleDelete(b.id)} disabled={isTemp}
                              className="text-red-400 hover:text-red-600 text-xs disabled:opacity-40">
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold">
                    <td colSpan={6} className="p-3 text-sm text-gray-700">
                      Grand Total — {bills.filter(b => b.status !== 'void').length} bills
                    </td>
                    <td className="p-3 text-right font-mono text-red-700 text-sm">{fmt(grandTotal)}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Category breakdown */}
        {bills.length > 0 && (() => {
          const catMap: Record<string, number> = {}
          for (const b of bills.filter(b => b.status !== 'void')) {
            const cat = b.category || 'Uncategorized'
            catMap[cat] = (catMap[cat] || 0) + Number(b.amount)
          }
          const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1])
          if (cats.length === 0) return null
          return (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="font-bold text-gray-800 mb-4">Bills by Category</h2>
              <div className="space-y-2">
                {cats.map(([cat, total]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{cat}</span>
                    <span className="font-semibold text-red-600">{fmt(total)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-bold">
                  <span className="text-gray-700">Total</span>
                  <span className="text-red-700">{fmt(grandTotal)}</span>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </main>
  )
}
