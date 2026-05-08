'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CATEGORIES } from '@/lib/categories'

type Transaction = {
  id: string
  date: string
  description: string
  amount: number
  type: 'income' | 'expense' | 'transfer'
  category: string
  vendor: string
  project_id?: string
  reconciled?: boolean
}

type Project = { id: string; name: string }

const EMPTY_FORM = { date: '', description: '', amount: '', type: 'income', category: '', vendor: '', project_id: '' }
const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent placeholder:text-gray-400 transition-all min-h-[44px]'

// ── Accessible autocomplete input ─────────────────────────────────────────────
function AutocompleteInput({
  id, value, onChange, suggestions, placeholder, required, className,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  suggestions: string[]
  placeholder?: string
  required?: boolean
  className?: string
}) {
  const [open, setOpen]        = useState(false)
  const [activeIdx, setActive] = useState(-1)
  const containerRef           = useRef<HTMLDivElement>(null)
  const listId                 = `${id}-list`

  const filtered = suggestions
    .filter(s => s.toLowerCase().includes(value.toLowerCase()) && s !== value)
    .slice(0, 7)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setActive(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setActive(-1) }, [filtered.length])

  const choose = (s: string) => { onChange(s); setOpen(false); setActive(-1) }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); choose(filtered[activeIdx]) }
    else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); setActive(-1) }
  }

  return (
    <div className="relative" ref={containerRef}>
      <input
        id={id}
        type="text"
        required={required}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open && filtered.length > 0}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={activeIdx >= 0 ? `${listId}-opt-${activeIdx}` : undefined}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1) }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className={className}
      />
      {open && filtered.length > 0 && (
        <ul id={listId} role="listbox"
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {filtered.map((s, i) => (
            <li key={s} id={`${listId}-opt-${i}`} role="option" aria-selected={activeIdx === i}
              onMouseDown={e => { e.preventDefault(); choose(s) }}
              className={`px-3 py-2.5 text-sm cursor-pointer transition ${
                activeIdx === i ? 'bg-[#EEF4FB] text-[#0F4C81] font-medium' : 'hover:bg-gray-50 text-gray-700'
              }`}>
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Frequent transactions ─────────────────────────────────────────────────────
type FreqTx = { key: string; type: string; description: string; vendor: string; category: string; amount: number; count: number }

function getFrequent(txs: Transaction[]): FreqTx[] {
  const map = new Map<string, FreqTx>()
  for (const t of txs) {
    if (!t.description) continue
    const key = `${t.type}|${t.description}|${t.vendor || ''}|${t.category}`
    if (map.has(key)) { map.get(key)!.count++ }
    else map.set(key, { key, type: t.type, description: t.description, vendor: t.vendor || '', category: t.category, amount: t.amount, count: 1 })
  }
  return Array.from(map.values()).filter(f => f.count >= 2).sort((a, b) => b.count - a.count).slice(0, 5)
}

// ── Table loading skeleton ────────────────────────────────────────────────────
function TableSkeleton() {
  return (
    <div className="p-6 space-y-3" aria-label="Loading transactions" aria-busy="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-20 shrink-0" />
          <div className="h-4 bg-gray-200 rounded flex-1" />
          <div className="h-4 bg-gray-200 rounded w-28 shrink-0 hidden sm:block" />
          <div className="h-4 bg-gray-200 rounded w-20 shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [projects, setProjects]         = useState<Project[]>([])
  const [unpaidBills, setUnpaidBills]   = useState(0)
  const [loading, setLoading]           = useState(true)
  const [showForm, setShowForm]         = useState(false)
  const [filterType, setFilterType]     = useState('')
  const [filterProject, setFilterProject] = useState('')
  const [form, setForm] = useState({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  // Edit state
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editForm, setEditForm]     = useState<typeof EMPTY_FORM & { date: string }>({ ...EMPTY_FORM, date: '' })
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError]   = useState('')
  const [showRules, setShowRules]   = useState(false)

  const load = async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterType)    params.set('type', filterType)
    if (filterProject) params.set('project_id', filterProject)
    const qs = params.toString()
    const res = await fetch(`/api/accounting/transactions${qs ? '?' + qs : ''}`)
    const data = await res.json()
    setTransactions(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => {
    fetch('/api/accounting/projects').then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : []))
    // Fetch unpaid bills total for combined accounting view
    fetch('/api/accounting/bills?status=unpaid').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setUnpaidBills(d.reduce((s: number, b: { amount: number }) => s + Number(b.amount), 0))
    })
  }, [])
  useEffect(() => { load() }, [filterType, filterProject])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')

    const tempId = 'temp-' + Date.now()
    const optimistic: Transaction = {
      id: tempId,
      date: form.date,
      description: form.description,
      amount: parseFloat(form.amount),
      type: form.type as Transaction['type'],
      category: form.category,
      vendor: form.vendor,
      project_id: form.project_id || undefined,
      reconciled: false,
    }
    setTransactions(prev => [optimistic, ...prev])
    setShowForm(false)
    setForm({ ...EMPTY_FORM, date: new Date().toISOString().split('T')[0] })

    const res = await fetch('/api/accounting/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    if (res.ok) {
      const saved = await res.json()
      setTransactions(prev => prev.map(t => t.id === tempId ? saved : t))
    } else {
      const d = await res.json()
      setTransactions(prev => prev.filter(t => t.id !== tempId))
      setShowForm(true)
      setError(d.error || 'Failed to save')
    }
    setSaving(false)
  }

  const startEdit = (t: Transaction) => {
    setEditingId(t.id)
    setEditForm({
      date: t.date,
      description: t.description,
      amount: String(t.amount),
      type: t.type,
      category: t.category || '',
      vendor: t.vendor || '',
      project_id: t.project_id || '',
    })
    setEditError('')
  }

  const cancelEdit = () => { setEditingId(null); setEditError('') }

  const handleEditSave = async (id: string) => {
    setEditSaving(true); setEditError('')

    const updated: Transaction = {
      id,
      date: editForm.date,
      description: editForm.description,
      amount: parseFloat(editForm.amount),
      type: editForm.type as Transaction['type'],
      category: editForm.category,
      vendor: editForm.vendor,
      project_id: editForm.project_id || undefined,
    }

    const prev = transactions
    setTransactions(txns => txns.map(t => t.id === id ? { ...t, ...updated } : t))
    setEditingId(null)

    const res = await fetch('/api/accounting/transactions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...editForm, amount: parseFloat(editForm.amount) }),
    })

    if (!res.ok) {
      const d = await res.json()
      setTransactions(prev)
      setEditingId(id)
      setEditError(d.error || 'Failed to update')
    }
    setEditSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return
    const prev = transactions
    setTransactions(txns => txns.filter(t => t.id !== id))
    const res = await fetch(`/api/accounting/transactions?id=${id}`, { method: 'DELETE' })
    if (!res.ok) setTransactions(prev)
  }

  const applyFrequent = (f: FreqTx) => {
    setForm(p => ({ ...p, type: f.type, description: f.description, vendor: f.vendor, category: f.category, amount: String(f.amount) }))
  }

  const descSuggestions   = Array.from(new Set(transactions.map(t => t.description).filter(Boolean))).sort()
  const vendorSuggestions = Array.from(new Set(transactions.map(t => t.vendor).filter(Boolean))).sort()
  const frequent          = getFrequent(transactions)

  const totalIncome   = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)
  const netCash       = totalIncome - totalExpenses
  const grandNet      = netCash - unpaidBills   // net after all obligations

  // Running balance sorted by date (newest first in table, but balance computed oldest-first)
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  let bal = 0
  const balanceMap = new Map<string, number>()
  for (const t of sorted) {
    if (t.type === 'income')   bal += Number(t.amount)
    if (t.type === 'expense')  bal -= Number(t.amount)
    balanceMap.set(t.id, bal)
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/accounting" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <span className="text-gray-300" aria-hidden="true">|</span>
          <h1 className="font-bold text-gray-800">Transactions</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowRules(r => !r)}
            className={`text-sm px-3 py-2 rounded-lg border font-medium transition ${showRules ? 'bg-amber-50 border-amber-300 text-amber-700' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
            ⚡ Rules
          </button>
          <a href="/api/export?type=transactions" className="btn-secondary text-sm py-2">Export CSV</a>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm">+ Add Transaction</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-4">

        {/* Auto Rules Panel */}
        {showRules && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-amber-900">⚡ Auto Rules</h3>
                <p className="text-xs text-amber-700 mt-0.5">Automatically categorize transactions based on description or vendor keywords.</p>
              </div>
              <button onClick={() => setShowRules(false)} className="text-amber-400 hover:text-amber-700 text-lg leading-none">×</button>
            </div>
            <div className="bg-white rounded-lg border border-amber-100 p-4 text-center">
              <p className="text-sm text-gray-600 mb-1">No rules configured yet.</p>
              <p className="text-xs text-gray-400 mb-3">Rules run automatically when transactions are imported or created.</p>
              <button className="text-sm px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition opacity-50 cursor-not-allowed" disabled>
                + Create Rule
              </button>
              <span className="ml-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded font-medium">Coming soon</span>
            </div>
            <div className="text-xs text-amber-700 space-y-1">
              <p className="font-semibold">Example rules you&apos;ll be able to create:</p>
              <p>• If description contains <span className="font-mono bg-amber-100 px-1 rounded">AWS</span> → set category to <span className="font-mono bg-amber-100 px-1 rounded">Software &amp; Subscriptions</span></p>
              <p>• If vendor is <span className="font-mono bg-amber-100 px-1 rounded">Stripe</span> → set type to <span className="font-mono bg-amber-100 px-1 rounded">Income</span></p>
            </div>
          </div>
        )}

        {/* KPI Summary — 4 cards including Accounts Payable (bills) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" role="region" aria-label="Financial summary">
          <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Income</p>
            <p className="text-xl font-bold text-green-600 mt-1">{fmt(totalIncome)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Expenses</p>
            <p className="text-xl font-bold text-red-600 mt-1">{fmt(totalExpenses)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Accounts Payable</p>
            <p className="text-xl font-bold text-orange-500 mt-1">{fmt(unpaidBills)}</p>
            <p className="text-xs text-gray-400 mt-0.5">unpaid bills</p>
          </div>
          <div className={`bg-white p-4 rounded-xl border-2 text-center ${grandNet >= 0 ? 'border-green-300' : 'border-red-300'}`}>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Grand Net</p>
            <p className={`text-xl font-bold mt-1 ${grandNet >= 0 ? 'text-green-700' : 'text-red-700'}`}>
              {fmt(grandNet)}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">income − expenses − bills</p>
          </div>
        </div>

        {/* Unpaid bills callout */}
        {unpaidBills > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700 flex justify-between items-center">
            <span>
              Cash balance is <strong>{fmt(netCash)}</strong> — paying all unpaid bills leaves <strong>{fmt(grandNet)}</strong>
            </span>
            <Link href="/accounting/bills" className="font-semibold hover:underline whitespace-nowrap ml-4">Manage Bills →</Link>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center" role="toolbar" aria-label="Filter transactions">
          <div className="flex gap-1" role="group" aria-label="Filter by type">
            {['', 'income', 'expense', 'transfer'].map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                aria-pressed={filterType === t}
                className={`px-4 py-2 rounded-full text-sm font-medium transition min-h-[36px] ${filterType === t ? 'bg-[#0F4C81] text-white' : 'bg-white border border-gray-200 hover:border-[#0F4C81] text-gray-600'}`}>
                {t === '' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          {projects.length > 0 && (
            <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
              aria-label="Filter by project"
              className="ml-auto border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white min-h-[36px]">
              <option value="">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          )}
        </div>

        {/* Add Form */}
        {showForm && (
          <section className="bg-white rounded-xl border border-[#0F4C81] p-6 shadow-sm space-y-5" aria-label="New transaction form">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-[#0F4C81]">New Transaction</h2>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Close form"
                className="text-gray-400 hover:text-gray-600 text-lg leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition">
                ✕
              </button>
            </div>

            {/* Frequent quick-fill */}
            {frequent.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Frequent — click to fill</p>
                <div className="flex flex-wrap gap-2" role="list" aria-label="Frequent transactions">
                  {frequent.map(f => (
                    <button key={f.key} type="button" role="listitem" onClick={() => applyFrequent(f)}
                      aria-label={`Fill ${f.description}, ${fmt(f.amount)}`}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs hover:border-[#0F4C81] hover:bg-[#EEF4FB] transition group min-h-[36px]">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${f.type === 'income' ? 'bg-green-500' : f.type === 'expense' ? 'bg-red-400' : 'bg-gray-400'}`} aria-hidden="true" />
                      <span className="font-medium text-gray-700 group-hover:text-[#0F4C81] max-w-[120px] truncate">{f.description}</span>
                      {f.vendor && <span className="text-gray-400 max-w-[80px] truncate hidden sm:inline">{f.vendor}</span>}
                      <span className={`font-mono font-semibold ${f.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>{fmt(f.amount)}</span>
                      <span className="text-gray-300">×{f.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="tx-date" className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Date</label>
                <input id="tx-date" type="date" required value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label htmlFor="tx-type" className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Type</label>
                <select id="tx-type" value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value, category: '' })} className={inputCls}>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                </select>
              </div>
              <div>
                <label htmlFor="tx-amount" className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Amount ($)</label>
                <input id="tx-amount" type="number" step="0.01" min="0" required value={form.amount}
                  onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className={inputCls} />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="tx-description" className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Description</label>
                <AutocompleteInput id="tx-description" value={form.description}
                  onChange={v => setForm({ ...form, description: v })}
                  suggestions={descSuggestions} placeholder="What was this for?" required className={inputCls} />
              </div>
              <div>
                <label htmlFor="tx-category" className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Category</label>
                <select id="tx-category" value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls}>
                  <option value="">Select category</option>
                  {(CATEGORIES[form.type as keyof typeof CATEGORIES] || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="tx-vendor" className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Vendor / Payer</label>
                <AutocompleteInput id="tx-vendor" value={form.vendor}
                  onChange={v => setForm({ ...form, vendor: v })}
                  suggestions={vendorSuggestions} placeholder="Company or person" className={inputCls} />
              </div>
              {projects.length > 0 && (
                <div>
                  <label htmlFor="tx-project" className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Project (optional)</label>
                  <select id="tx-project" value={form.project_id}
                    onChange={e => setForm({ ...form, project_id: e.target.value })} className={inputCls}>
                    <option value="">No project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              {error && (
                <p role="alert" className="col-span-full text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="col-span-full flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary text-sm">
                  {saving ? <><span className="spinner-sm" aria-hidden="true" /> Saving…</> : 'Save Transaction'}
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
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                <span className="text-3xl">💰</span>
              </div>
              <p className="font-semibold text-gray-700 mb-1">
                {filterType ? `No ${filterType} transactions` : 'No transactions yet'}
              </p>
              <p className="text-sm text-gray-400 mb-5">
                {filterType ? 'Try a different filter or add a new transaction.' : 'Add your first transaction to start tracking your finances.'}
              </p>
              <button onClick={() => setShowForm(true)} className="btn-primary text-sm">Add Transaction</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-left">Vendor</th>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-left">Project</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">Running Balance</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {transactions.map(t => {
                    const proj    = projects.find(p => p.id === t.project_id)
                    const isTemp  = t.id.startsWith('temp-')
                    const runBal  = balanceMap.get(t.id)

                    if (editingId === t.id) {
                      return (
                        <tr key={t.id} className="bg-blue-50">
                          <td className="p-2">
                            <input type="date" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                          </td>
                          <td className="p-2">
                            <input type="text" required value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs" />
                          </td>
                          <td className="p-2">
                            <input type="text" value={editForm.vendor} onChange={e => setEditForm({ ...editForm, vendor: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs" placeholder="Vendor" />
                          </td>
                          <td className="p-2">
                            <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                              className="w-full border border-gray-300 rounded px-2 py-1 text-xs">
                              <option value="">Uncategorized</option>
                              {(CATEGORIES[editForm.type as keyof typeof CATEGORIES] || []).map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </td>
                          <td className="p-2">
                            {projects.length > 0 ? (
                              <select value={editForm.project_id} onChange={e => setEditForm({ ...editForm, project_id: e.target.value })}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-xs">
                                <option value="">No project</option>
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                              </select>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                          <td className="p-2">
                            <div className="flex flex-col gap-1 items-end">
                              <select value={editForm.type} onChange={e => setEditForm({ ...editForm, type: e.target.value, category: '' })}
                                className="border border-gray-300 rounded px-2 py-1 text-xs w-24">
                                <option value="income">Income</option>
                                <option value="expense">Expense</option>
                                <option value="transfer">Transfer</option>
                              </select>
                              <input type="number" step="0.01" min="0" required value={editForm.amount}
                                onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                                className="border border-gray-300 rounded px-2 py-1 text-xs w-24 text-right" />
                            </div>
                          </td>
                          <td className="p-2 text-right text-xs text-gray-400">—</td>
                          <td className="p-2 text-center">
                            {editError && <p className="text-red-500 text-xs mb-1">{editError}</p>}
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => handleEditSave(t.id)} disabled={editSaving}
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
                      <tr key={t.id} className={`hover:bg-gray-50 transition-opacity ${isTemp ? 'opacity-60' : ''}`}>
                        <td className="p-3 text-gray-500 whitespace-nowrap">{t.date}</td>
                        <td className="p-3 font-medium">{t.description}</td>
                        <td className="p-3 text-gray-500">{t.vendor || '—'}</td>
                        <td className="p-3"><span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{t.category || 'Uncategorized'}</span></td>
                        <td className="p-3">
                          {proj
                            ? <Link href="/accounting/projects" className="text-xs text-[#0F4C81] hover:underline">{proj.name}</Link>
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                        <td className={`p-3 text-right font-mono font-semibold whitespace-nowrap ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {t.reconciled && <span className="text-green-400 mr-1 text-xs">✓</span>}
                          {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}{fmt(t.amount)}
                        </td>
                        <td className={`p-3 text-right font-mono text-xs ${
                          runBal === undefined ? 'text-gray-300'
                          : runBal >= 0 ? 'text-green-700' : 'text-red-600'
                        }`}>
                          {runBal !== undefined ? fmt(runBal) : '—'}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex gap-2 justify-center">
                            <button onClick={() => startEdit(t)} disabled={isTemp}
                              className="text-[#0F4C81] hover:text-[#0a3a66] text-xs disabled:opacity-40">Edit</button>
                            <button onClick={() => handleDelete(t.id)} disabled={isTemp}
                              className="text-red-400 hover:text-red-600 text-xs disabled:opacity-40">Delete</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-sm">
                    <td colSpan={5} className="p-3 text-gray-700">
                      Grand Total — {transactions.length} transactions
                    </td>
                    <td className="p-3 text-right font-mono">
                      <span className="text-green-700">+{fmt(totalIncome)}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="text-red-600">-{fmt(totalExpenses)}</span>
                    </td>
                    <td className={`p-3 text-right font-mono ${netCash >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {fmt(netCash)}
                    </td>
                    <td />
                  </tr>
                  {unpaidBills > 0 && (
                    <tr className="bg-orange-50 border-t border-orange-200 text-sm">
                      <td colSpan={5} className="p-3 text-orange-700">
                        After paying all unpaid bills ({fmt(unpaidBills)})
                      </td>
                      <td colSpan={2} className={`p-3 text-right font-mono font-bold ${grandNet >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {fmt(grandNet)}
                      </td>
                      <td />
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
