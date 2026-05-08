'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type Budget = {
  id: string
  category: string
  amount: number
  period: 'monthly' | 'quarterly' | 'annually'
}

type Transaction = {
  id: string
  date: string
  amount: number
  type: string
  category: string
}

const EXPENSE_CATEGORIES = [
  'Office & Supplies', 'Travel', 'Marketing', 'Software / SaaS',
  'Meals & Entertainment', 'Utilities', 'Insurance', 'Shipping',
  'Rent', 'Equipment', 'Payroll', 'Legal & Professional', 'Other Expense',
]

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually',
}

const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent min-h-[44px] bg-white'

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100)
  const color = pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-400' : 'bg-green-500'
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  )
}

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ category: '', amount: '', period: 'monthly' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const [budgetRes, txRes] = await Promise.all([
      fetch('/api/accounting/budgets'),
      fetch('/api/accounting/transactions'),
    ])
    const budgetData = await budgetRes.json()
    const txData = await txRes.json()
    setBudgets(Array.isArray(budgetData) ? budgetData : [])
    setTransactions(Array.isArray(txData) ? txData : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

  const spendByCategory = (category: string) =>
    transactions
      .filter(t => t.type === 'expense' && t.category === category && t.date >= monthStart && t.date <= monthEnd)
      .reduce((s, t) => s + Number(t.amount), 0)

  const totalBudget = budgets.reduce((s, b) => s + Number(b.amount), 0)
  const totalSpent = budgets.reduce((s, b) => s + spendByCategory(b.category), 0)
  const remaining = totalBudget - totalSpent
  const pctUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const res = await fetch('/api/accounting/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
    })
    if (res.ok) {
      setShowForm(false)
      setForm({ category: '', amount: '', period: 'monthly' })
      load()
    } else {
      const d = await res.json()
      setError(d.error || 'Failed to save budget')
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget?')) return
    const prev = budgets
    setBudgets(bs => bs.filter(b => b.id !== id))
    const res = await fetch(`/api/accounting/budgets?id=${id}`, { method: 'DELETE' })
    if (!res.ok) setBudgets(prev)
  }

  const startEdit = (b: Budget) => { setEditingId(b.id); setEditAmount(String(b.amount)) }

  const saveEdit = async (b: Budget) => {
    setEditSaving(true)
    const newAmount = parseFloat(editAmount)
    const prev = budgets
    setBudgets(bs => bs.map(x => (x.id === b.id ? { ...x, amount: newAmount } : x)))
    setEditingId(null)
    const res = await fetch('/api/accounting/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: b.category, amount: newAmount, period: b.period }),
    })
    if (!res.ok) { setBudgets(prev); setEditingId(b.id) }
    setEditSaving(false)
  }

  const usedCategories = new Set(budgets.map(b => b.category))
  const availableCategories = EXPENSE_CATEGORIES.filter(c => !usedCategories.has(c))

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/accounting" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <span className="text-gray-300">|</span>
          <h1 className="font-bold text-gray-800">Budgets</h1>
        </div>
        {availableCategories.length > 0 && (
          <button onClick={() => setShowForm(s => !s)} className="btn-primary text-sm">+ Add Budget</button>
        )}
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse h-24" />)}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[{ label: 'Total Budget', value: fmt(totalBudget), color: 'text-gray-800' },
                { label: 'Spent This Month', value: fmt(totalSpent), color: 'text-red-600' },
                { label: 'Remaining', value: fmt(remaining), color: remaining >= 0 ? 'text-green-600' : 'text-red-600' },
                { label: '% Used', value: pctUsed.toFixed(0) + '%', color: pctUsed > 90 ? 'text-red-600' : pctUsed > 75 ? 'text-amber-500' : 'text-[#0F4C81]' },
              ].map(c => (
                <div key={c.label} className="text-center">
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{c.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
            {totalBudget > 0 && (
              <div className="space-y-1">
                <ProgressBar pct={pctUsed} />
                <p className="text-xs text-gray-400 text-right">{pctUsed.toFixed(1)}% of total budget used this month</p>
              </div>
            )}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-xl border border-[#0F4C81] shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#0F4C81]">Set Budget</h2>
              <button type="button" onClick={() => { setShowForm(false); setError('') }} className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-lg">×</button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Category</label>
                <select required value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={inputCls}>
                  <option value="">Select category</option>
                  {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Amount ($)</label>
                <input type="number" required min="1" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">Period</label>
                <select value={form.period} onChange={e => setForm({ ...form, period: e.target.value })} className={inputCls}>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
              {error && <p className="col-span-full text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <div className="col-span-full flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : 'Save Budget'}</button>
                <button type="button" onClick={() => { setShowForm(false); setError('') }} className="btn-secondary text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {!loading && budgets.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-16 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><span className="text-3xl">◎</span></div>
            <h2 className="font-bold text-gray-700 text-lg mb-2">Set your first budget</h2>
            <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">Track spending against your goals. Add budgets for each expense category and see real-time progress.</p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm">+ Add Budget</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgets.map(b => {
              const spent = spendByCategory(b.category)
              const rem = Number(b.amount) - spent
              const pct = Number(b.amount) > 0 ? (spent / Number(b.amount)) * 100 : 0
              const isEditing = editingId === b.id
              return (
                <div key={b.id} onClick={() => { if (!isEditing && editingId === null) startEdit(b) }}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4 cursor-pointer hover:border-[#0F4C81] transition-colors group relative">
                  <button onClick={e => { e.stopPropagation(); handleDelete(b.id) }}
                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover:opacity-100 text-lg leading-none">×</button>
                  <div className="flex items-start justify-between pr-6">
                    <div>
                      <h3 className="font-bold text-gray-800 text-sm">{b.category}</h3>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">{PERIOD_LABELS[b.period]}</span>
                    </div>
                    <div className="text-right">
                      {isEditing ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <input type="number" min="0" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} autoFocus
                            className="w-24 border border-[#0F4C81] rounded-lg px-2 py-1 text-sm text-right focus:outline-none" />
                          <button onClick={() => saveEdit(b)} disabled={editSaving} className="px-2 py-1 bg-[#0F4C81] text-white rounded-lg text-xs hover:bg-[#0a3a66] disabled:opacity-50">{editSaving ? '…' : 'Save'}</button>
                          <button onClick={() => setEditingId(null)} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs">✕</button>
                        </div>
                      ) : (
                        <p className="text-lg font-bold text-gray-800">{fmt(Number(b.amount))}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <ProgressBar pct={pct} />
                    <div className="flex justify-between text-xs">
                      <span className={`font-semibold ${pct > 90 ? 'text-red-600' : pct > 75 ? 'text-amber-600' : 'text-gray-500'}`}>{pct.toFixed(0)}% used</span>
                      <span className={`font-semibold ${rem >= 0 ? 'text-green-600' : 'text-red-600'}`}>{rem >= 0 ? fmt(rem) + ' left' : fmt(Math.abs(rem)) + ' over'}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                    <div><p className="text-xs text-gray-400">Spent</p><p className="text-sm font-semibold text-red-600">{fmt(spent)}</p></div>
                    <div className="text-right"><p className="text-xs text-gray-400">Budget</p><p className="text-sm font-semibold text-gray-700">{fmt(Number(b.amount))}</p></div>
                  </div>
                  {!isEditing && <p className="text-xs text-gray-300 text-center group-hover:text-[#0F4C81] transition-colors">Click to edit amount</p>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}