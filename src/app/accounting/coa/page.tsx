'use client'

import { useState, useEffect, useCallback } from 'react'
import AccountingShell from '@/components/AccountingShell'

type Account = {
  id: string
  code: string
  name: string
  account_type: string
  sub_type: string
  description: string
  is_active: boolean
  balance?: number
}

const TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Revenue', 'Cost of Goods Sold', 'Expense']
const TYPE_COLORS: Record<string, string> = {
  'Asset':              'bg-blue-100 text-blue-700',
  'Liability':          'bg-red-100 text-red-700',
  'Equity':             'bg-purple-100 text-purple-700',
  'Revenue':            'bg-green-100 text-green-700',
  'Cost of Goods Sold': 'bg-orange-100 text-orange-700',
  'Expense':            'bg-yellow-100 text-yellow-700',
}
const ACCOUNT_TYPES = ['Asset', 'Liability', 'Equity', 'Revenue', 'Cost of Goods Sold', 'Expense']

const fmt = (n: number) =>
  '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading]   = useState(true)
  const [seeding, setSeeding]   = useState(false)
  const [search,  setSearch]    = useState('')
  const [filterType, setFilterType] = useState('All')
  const [showAdd, setShowAdd]   = useState(false)
  const [saving,  setSaving]    = useState(false)
  const [error,   setError]     = useState('')

  const [form, setForm] = useState({
    code: '', name: '', account_type: 'Asset', sub_type: '', description: '',
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/accounting/coa')
      const data = await res.json()
      setAccounts(data.accounts || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function seed() {
    setSeeding(true)
    try {
      await fetch('/api/accounting/coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      })
      await load()
    } finally {
      setSeeding(false)
    }
  }

  async function addAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!form.code || !form.name) { setError('Account code and name are required.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/accounting/coa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      setAccounts(prev => [...prev, data.account].sort((a, b) => a.code.localeCompare(b.code)))
      setForm({ code: '', name: '', account_type: 'Asset', sub_type: '', description: '' })
      setShowAdd(false)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(acct: Account) {
    const updated = { ...acct, is_active: !acct.is_active }
    setAccounts(prev => prev.map(a => a.id === acct.id ? updated : a))
    await fetch('/api/accounting/coa', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: acct.id, is_active: !acct.is_active }),
    })
  }

  const filtered = accounts.filter(a => {
    const matchSearch = !search ||
      a.code.toLowerCase().includes(search.toLowerCase()) ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.sub_type.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'All' || a.account_type === filterType
    return matchSearch && matchType
  })

  const grouped = TYPE_ORDER.reduce<Record<string, Account[]>>((acc, type) => {
    const items = filtered.filter(a => a.account_type === type)
    if (items.length) acc[type] = items
    return acc
  }, {})

  const totals = {
    assets:      accounts.filter(a => a.account_type === 'Asset').reduce((s, a) => s + (a.balance || 0), 0),
    liabilities: accounts.filter(a => a.account_type === 'Liability').reduce((s, a) => s + (a.balance || 0), 0),
    revenue:     accounts.filter(a => a.account_type === 'Revenue').reduce((s, a) => s + (a.balance || 0), 0),
    expenses:    accounts.filter(a => a.account_type === 'Expense').reduce((s, a) => s + (a.balance || 0), 0),
  }

  return (
    <AccountingShell>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Chart of Accounts</h1>
            <p className="text-sm text-gray-400 mt-0.5">{accounts.length} accounts · double-entry ledger structure</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {accounts.length === 0 && !loading && (
              <button onClick={seed} disabled={seeding}
                className="px-4 py-2 bg-[#0F4C81] hover:bg-[#082D4F] text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                {seeding ? 'Seeding…' : '⚡ Load Default Accounts'}
              </button>
            )}
            <button onClick={() => setShowAdd(v => !v)}
              className="px-4 py-2 bg-white border border-gray-200 hover:border-[#0F4C81] text-[#0F4C81] text-sm font-semibold rounded-lg transition">
              + Add Account
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        {accounts.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Assets',      value: totals.assets,      color: 'text-blue-700' },
              { label: 'Total Liabilities', value: totals.liabilities, color: 'text-red-600' },
              { label: 'Total Revenue',     value: totals.revenue,     color: 'text-green-700' },
              { label: 'Total Expenses',    value: totals.expenses,    color: 'text-orange-600' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{c.label}</p>
                <p className={`text-2xl font-bold mt-1 ${c.color}`}>{fmt(c.value)}</p>
              </div>
            ))}
          </div>
        )}

        {/* Add Account Form */}
        {showAdd && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-4">New Account</h2>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <form onSubmit={addAccount} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Account Code *</label>
                <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                  placeholder="e.g. 1050"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Account Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Petty Cash"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Account Type *</label>
                <select value={form.account_type} onChange={e => setForm(p => ({ ...p, account_type: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]">
                  {ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Sub Type</label>
                <input value={form.sub_type} onChange={e => setForm(p => ({ ...p, sub_type: e.target.value }))}
                  placeholder="e.g. Current Asset"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional note"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div className="flex items-end gap-2">
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 bg-[#0F4C81] hover:bg-[#082D4F] text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Account'}
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search + Filter */}
        {accounts.length > 0 && (
          <div className="flex flex-wrap gap-3 items-center">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search accounts…"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
            <div className="flex gap-1 flex-wrap">
              {['All', ...ACCOUNT_TYPES].map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    filterType === t
                      ? 'bg-[#0F4C81] text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-[#0F4C81]'
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && accounts.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">≡</span>
            </div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">No accounts yet</h3>
            <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
              Load the standard chart of accounts with 30+ pre-configured accounts covering assets, liabilities, equity, revenue, and expenses.
            </p>
            <button onClick={seed} disabled={seeding}
              className="px-6 py-2.5 bg-[#0F4C81] hover:bg-[#082D4F] text-white font-semibold rounded-lg transition disabled:opacity-50">
              {seeding ? 'Loading…' : '⚡ Load Default Chart of Accounts'}
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-12 text-gray-400 text-sm">Loading accounts…</div>
        )}

        {/* Grouped Account Tables */}
        {Object.entries(grouped).map(([type, items]) => (
          <div key={type} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide ${TYPE_COLORS[type] || 'bg-gray-100 text-gray-600'}`}>
                  {type}
                </span>
                <span className="text-xs text-gray-400">{items.length} account{items.length !== 1 ? 's' : ''}</span>
              </div>
              <span className="text-sm font-semibold text-gray-700">
                {fmt(items.reduce((s, a) => s + (a.balance || 0), 0))}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-400 uppercase">
                    <th className="px-4 py-2.5 text-left font-medium w-24">Code</th>
                    <th className="px-4 py-2.5 text-left font-medium">Account Name</th>
                    <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Sub Type</th>
                    <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">Description</th>
                    <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                    <th className="px-4 py-2.5 text-center font-medium w-20">Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(acct => (
                    <tr key={acct.id} className={`hover:bg-gray-50 transition ${!acct.is_active ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-3 font-mono text-xs text-[#0F4C81] font-semibold">{acct.code}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{acct.name}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{acct.sub_type || '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell truncate max-w-[200px]">{acct.description || '—'}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-gray-700">
                        {acct.balance ? fmt(acct.balance) : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleActive(acct)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${acct.is_active ? 'bg-[#0F4C81]' : 'bg-gray-200'}`}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${acct.is_active ? 'translate-x-4' : 'translate-x-1'}`} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={4} className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">
                      {type} Total
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-sm text-gray-800">
                      {fmt(items.reduce((s, a) => s + (a.balance || 0), 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}
      </div>
    </AccountingShell>
  )
}
