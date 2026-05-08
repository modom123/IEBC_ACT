'use client'

import { useState, useEffect, useCallback } from 'react'
import AccountingShell from '@/components/AccountingShell'

type JournalLine = {
  account_code: string
  account_name: string
  description: string
  debit: number
  credit: number
}

type JournalEntry = {
  id: string
  entry_number: string
  date: string
  description: string
  reference: string | null
  status: 'draft' | 'posted'
  lines: JournalLine[]
  total_debit: number
  total_credit: number
}

const fmt = (n: number) =>
  n ? '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'
const today = () => new Date().toISOString().split('T')[0]

const emptyLine = (): JournalLine & { _key: number } => ({
  _key: Date.now() + Math.random(),
  account_code: '', account_name: '', description: '', debit: 0, credit: 0,
})

export default function JournalEntriesPage() {
  const [entries,  setEntries]  = useState<JournalEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [filter,   setFilter]   = useState<'all' | 'draft' | 'posted'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const [formDate,   setFormDate]   = useState(today)
  const [formDesc,   setFormDesc]   = useState('')
  const [formRef,    setFormRef]    = useState('')
  const [formStatus, setFormStatus] = useState<'draft' | 'posted'>('posted')
  const [lines, setLines] = useState<(JournalLine & { _key: number })[]>([emptyLine(), emptyLine()])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/accounting/journal')
      const data = await res.json()
      setEntries(data.entries || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function addLine() { setLines(prev => [...prev, emptyLine()]) }
  function removeLine(key: number) { setLines(prev => prev.filter(l => l._key !== key)) }
  function updateLine(key: number, field: keyof JournalLine, value: string | number) {
    setLines(prev => prev.map(l => l._key === key ? { ...l, [field]: value } : l))
  }

  const totalDebit  = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const isBalanced  = Math.abs(totalDebit - totalCredit) < 0.01
  const hasContent  = lines.some(l => l.debit > 0 || l.credit > 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!formDesc) { setError('Description is required.'); return }
    if (!hasContent) { setError('Add at least one debit or credit line.'); return }
    if (!isBalanced) { setError(`Not balanced: debits ${fmt(totalDebit)} ≠ credits ${fmt(totalCredit)}`); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/accounting/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: formDate, description: formDesc, reference: formRef || null,
          status: formStatus,
          lines: lines.map(({ _key, ...l }) => ({ ...l, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
        }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      await load()
      setShowForm(false)
      setFormDate(today()); setFormDesc(''); setFormRef(''); setFormStatus('posted')
      setLines([emptyLine(), emptyLine()])
    } finally { setSaving(false) }
  }

  async function toggleStatus(entry: JournalEntry) {
    const newStatus = entry.status === 'draft' ? 'posted' : 'draft'
    setEntries(prev => prev.map(e => e.id === entry.id ? { ...e, status: newStatus } : e))
    await fetch('/api/accounting/journal', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: entry.id, status: newStatus }),
    })
  }

  const filtered = entries.filter(e => filter === 'all' || e.status === filter)
  const totalPosted = entries.filter(e => e.status === 'posted').reduce((s, e) => s + Number(e.total_debit), 0)

  return (
    <AccountingShell>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Journal Entries</h1>
            <p className="text-sm text-gray-400 mt-0.5">Double-entry bookkeeping — debits must equal credits</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="px-4 py-2 bg-[#0F4C81] hover:bg-[#082D4F] text-white text-sm font-semibold rounded-lg transition">
            + New Entry
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Entries',   value: String(entries.length),                                      color: 'text-[#0F4C81]' },
            { label: 'Posted',          value: String(entries.filter(e => e.status === 'posted').length),   color: 'text-green-700' },
            { label: 'Drafts',          value: String(entries.filter(e => e.status === 'draft').length),    color: 'text-yellow-600' },
            { label: 'Total Posted',    value: fmt(totalPosted),                                             color: 'text-gray-700' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* New Entry Form */}
        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="font-bold text-gray-800 mb-4">New Journal Entry</h2>
            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700 mb-3">{error}</div>}
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                  <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description *</label>
                  <input value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="Depreciation expense" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Reference</label>
                  <input value={formRef} onChange={e => setFormRef(e.target.value)} placeholder="Invoice #, check #, etc." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                </div>
              </div>

              {/* Lines */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-400 uppercase">
                      <th className="px-3 py-2 text-left font-medium">Account Code</th>
                      <th className="px-3 py-2 text-left font-medium">Account Name</th>
                      <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Memo</th>
                      <th className="px-3 py-2 text-right font-medium">Debit</th>
                      <th className="px-3 py-2 text-right font-medium">Credit</th>
                      <th className="px-3 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(line => (
                      <tr key={line._key}>
                        <td className="px-1 py-1">
                          <input value={line.account_code} onChange={e => updateLine(line._key, 'account_code', e.target.value)} placeholder="6000" className="w-24 border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0F4C81]" />
                        </td>
                        <td className="px-1 py-1">
                          <input value={line.account_name} onChange={e => updateLine(line._key, 'account_name', e.target.value)} placeholder="Payroll & Wages" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0F4C81]" />
                        </td>
                        <td className="px-1 py-1 hidden md:table-cell">
                          <input value={line.description} onChange={e => updateLine(line._key, 'description', e.target.value)} placeholder="Optional" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0F4C81]" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" step="0.01" min="0" value={line.debit || ''} onChange={e => updateLine(line._key, 'debit', e.target.value)} placeholder="0.00" className="w-28 border border-gray-200 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#0F4C81]" />
                        </td>
                        <td className="px-1 py-1">
                          <input type="number" step="0.01" min="0" value={line.credit || ''} onChange={e => updateLine(line._key, 'credit', e.target.value)} placeholder="0.00" className="w-28 border border-gray-200 rounded px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#0F4C81]" />
                        </td>
                        <td className="px-1 py-1">
                          <button type="button" onClick={() => removeLine(line._key)} className="text-gray-300 hover:text-red-400 transition px-1">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={`text-sm font-bold border-t-2 ${isBalanced && hasContent ? 'border-green-300' : hasContent ? 'border-red-300' : 'border-gray-200'}`}>
                      <td colSpan={3} className="px-3 py-2 text-xs text-gray-500 uppercase">Totals</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-800">{fmt(totalDebit)}</td>
                      <td className="px-3 py-2 text-right font-mono text-gray-800">{fmt(totalCredit)}</td>
                      <td />
                    </tr>
                    {hasContent && (
                      <tr>
                        <td colSpan={6} className={`px-3 py-1.5 text-xs font-semibold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                          {isBalanced ? '✓ Entry is balanced' : `⚠ Out of balance by ${fmt(Math.abs(totalDebit - totalCredit))}`}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3">
                <button type="button" onClick={addLine} className="text-sm text-[#0F4C81] hover:underline font-medium">+ Add Line</button>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={formStatus === 'posted'} onChange={e => setFormStatus(e.target.checked ? 'posted' : 'draft')} className="w-4 h-4 accent-[#0F4C81]" />
                    Post immediately
                  </label>
                  <button type="submit" disabled={saving || !isBalanced || !hasContent}
                    className="px-5 py-2 bg-[#0F4C81] hover:bg-[#082D4F] text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                    {saving ? 'Saving…' : formStatus === 'posted' ? 'Post Entry' : 'Save as Draft'}
                  </button>
                  <button type="button" onClick={() => { setShowForm(false); setError('') }}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition">Cancel</button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {([['all', 'All'], ['posted', 'Posted'], ['draft', 'Drafts']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filter === val ? 'bg-[#0F4C81] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#0F4C81]'}`}>
              {label} ({val === 'all' ? entries.length : entries.filter(e => e.status === val).length})
            </button>
          ))}
        </div>

        {/* Entries List */}
        {!loading && entries.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⊟</span>
            </div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">No journal entries</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
              Journal entries record the effect of transactions on your accounts using double-entry bookkeeping — every debit has an equal credit.
            </p>
            <button onClick={() => setShowForm(true)} className="px-5 py-2 bg-[#0F4C81] text-white text-sm font-semibold rounded-lg hover:bg-[#082D4F] transition">+ Create First Entry</button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(entry => (
              <div key={entry.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Entry Header Row */}
                <div
                  className="px-5 py-3.5 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-[#0F4C81]">{entry.entry_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${entry.status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {entry.status}
                      </span>
                      <span className="text-sm font-medium text-gray-800 truncate">{entry.description}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-400">{entry.date}</span>
                      {entry.reference && <span className="text-xs text-gray-400">Ref: {entry.reference}</span>}
                      <span className="text-xs text-gray-400">{entry.lines?.length || 0} lines</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold font-mono text-gray-800">{fmt(entry.total_debit)}</p>
                    <p className="text-xs text-gray-400">total</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={ev => { ev.stopPropagation(); toggleStatus(entry) }}
                      className={`px-2 py-1 text-xs rounded font-medium transition ${entry.status === 'posted' ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                      {entry.status === 'posted' ? 'Unpost' : 'Post'}
                    </button>
                    <span className={`text-gray-400 transition-transform duration-200 ${expanded === entry.id ? 'rotate-180' : ''}`}>▼</span>
                  </div>
                </div>

                {/* Lines Detail */}
                {expanded === entry.id && entry.lines && entry.lines.length > 0 && (
                  <div className="border-t border-gray-100 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-400 uppercase">
                          <th className="px-4 py-2 text-left font-medium">Code</th>
                          <th className="px-4 py-2 text-left font-medium">Account</th>
                          <th className="px-4 py-2 text-left font-medium hidden md:table-cell">Memo</th>
                          <th className="px-4 py-2 text-right font-medium">Debit</th>
                          <th className="px-4 py-2 text-right font-medium">Credit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {entry.lines.map((line, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-2 font-mono text-[#0F4C81] font-semibold">{line.account_code || '—'}</td>
                            <td className="px-4 py-2 text-gray-700 font-medium">{line.account_name || '—'}</td>
                            <td className="px-4 py-2 text-gray-400 hidden md:table-cell">{line.description || '—'}</td>
                            <td className="px-4 py-2 text-right font-mono text-gray-800">{line.debit ? fmt(line.debit) : '—'}</td>
                            <td className="px-4 py-2 text-right font-mono text-gray-800">{line.credit ? fmt(line.credit) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t border-gray-200 font-bold text-xs">
                          <td colSpan={3} className="px-4 py-2 text-gray-500 uppercase">Total</td>
                          <td className="px-4 py-2 text-right font-mono text-gray-800">{fmt(entry.total_debit)}</td>
                          <td className="px-4 py-2 text-right font-mono text-gray-800">{fmt(entry.total_credit)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {loading && <div className="text-center py-12 text-gray-400 text-sm">Loading entries…</div>}
      </div>
    </AccountingShell>
  )
}
