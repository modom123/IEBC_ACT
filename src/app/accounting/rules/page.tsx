'use client'
import { useEffect, useState } from 'react'

type Rule = {
  id: string
  match_field: string
  match_value: string
  set_category: string
  set_type: string
  priority: number
  is_active: boolean
}

const MATCH_FIELDS = [
  { value: 'description', label: 'Description' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'amount_greater_than', label: 'Amount Greater Than' },
  { value: 'amount_less_than', label: 'Amount Less Than' },
]

const EXPENSE_CATEGORIES = [
  'Office & Supplies', 'Travel', 'Marketing', 'Software / SaaS',
  'Meals & Entertainment', 'Utilities', 'Insurance', 'Shipping',
  'Rent', 'Equipment', 'Payroll', 'Legal & Professional', 'Other Expense',
]

const INCOME_CATEGORIES = [
  'Revenue', 'Consulting', 'Product Sale', 'Other Income',
]

const EMPTY_FORM = {
  match_field: 'description',
  match_value: '',
  set_category: '',
  set_type: '',
  priority: 50,
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81] focus:border-transparent placeholder:text-gray-400 transition-all min-h-[44px]'
const selectCls = inputCls + ' bg-white'

function matchFieldLabel(val: string) {
  return MATCH_FIELDS.find(f => f.value === val)?.label ?? val
}

function ruleToEnglish(rule: Rule) {
  const field = matchFieldLabel(rule.match_field)
  const isAmount = rule.match_field === 'amount_greater_than' || rule.match_field === 'amount_less_than'
  const condition = isAmount
    ? `amount is ${rule.match_field === 'amount_greater_than' ? 'greater than' : 'less than'} $${rule.match_value}`
    : `${field.toLowerCase()} contains "${rule.match_value}"`
  const action = [
    rule.set_category ? `set category to ${rule.set_category}` : null,
    rule.set_type ? `(${rule.set_type})` : null,
  ].filter(Boolean).join(' ')
  return `When ${condition} → ${action || 'no action set'}`
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/accounting/rules')
      const data = await res.json()
      setRules(data.rules ?? data ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const categories = form.set_type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  async function handleSave() {
    if (!form.match_value.trim() || !form.set_category) return
    setSaving(true)
    try {
      await fetch('/api/accounting/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, priority: Number(form.priority), is_active: true }),
      })
      setForm({ ...EMPTY_FORM })
      setShowForm(false)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(rule: Rule) {
    setTogglingId(rule.id)
    try {
      await fetch('/api/accounting/rules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, is_active: !rule.is_active }),
      })
      await load()
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this rule?')) return
    setDeletingId(id)
    try {
      await fetch('/api/accounting/rules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  const sorted = [...rules].sort((a, b) => b.priority - a.priority)

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#0F4C81]">Automation Rules</h1>
          <p className="text-sm text-gray-500 mt-1">Auto-categorize transactions as they come in</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 bg-[#0F4C81] text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-[#0d3f6d] transition-colors shadow-sm"
        >
          <span className="text-lg leading-none">+</span>
          Add Rule
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        Rules run automatically when transactions are imported from your bank. Higher priority rules run first.
      </div>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">New Rule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Match Field</label>
              <select
                className={selectCls}
                value={form.match_field}
                onChange={e => setForm(f => ({ ...f, match_field: e.target.value }))}
              >
                {MATCH_FIELDS.map(mf => (
                  <option key={mf.value} value={mf.value}>{mf.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Match Value</label>
              <input
                className={inputCls}
                placeholder={form.match_field.startsWith('amount') ? '100.00' : 'e.g. AWS'}
                value={form.match_value}
                onChange={e => setForm(f => ({ ...f, match_value: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Set Type (optional)</label>
              <select
                className={selectCls}
                value={form.set_type}
                onChange={e => setForm(f => ({ ...f, set_type: e.target.value, set_category: '' }))}
              >
                <option value="">— don&apos;t change —</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Set Category</label>
              <select
                className={selectCls}
                value={form.set_category}
                onChange={e => setForm(f => ({ ...f, set_category: e.target.value }))}
              >
                <option value="">Select category…</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority (0–100)</label>
              <input
                type="number"
                min={0}
                max={100}
                className={inputCls}
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !form.match_value.trim() || !form.set_category}
              className="bg-[#0F4C81] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-[#0d3f6d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving…' : 'Save Rule'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }) }}
              className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded flex-1" />
                <div className="h-4 bg-gray-200 rounded w-16" />
                <div className="h-4 bg-gray-200 rounded w-16" />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
            <p className="text-gray-400 text-sm">No rules yet. Create your first rule to auto-categorize transactions.</p>
          </div>
        ) : (
          sorted.map(rule => (
            <div
              key={rule.id}
              className={`bg-white rounded-xl shadow-sm border transition-all ${rule.is_active ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}
            >
              <div className="flex items-center gap-4 px-5 py-4">
                <button
                  onClick={() => toggleActive(rule)}
                  disabled={togglingId === rule.id}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${rule.is_active ? 'bg-[#0F4C81]' : 'bg-gray-300'}`}
                  title={rule.is_active ? 'Deactivate' : 'Activate'}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${rule.is_active ? 'translate-x-4' : 'translate-x-0'}`}
                  />
                </button>

                <p className="flex-1 text-sm text-gray-700 font-medium">{ruleToEnglish(rule)}</p>

                <span className="shrink-0 inline-flex items-center bg-gray-100 text-gray-600 text-xs font-medium px-2.5 py-1 rounded-full">
                  Priority {rule.priority}
                </span>

                {rule.set_type && (
                  <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${rule.set_type === 'income' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                    {rule.set_type}
                  </span>
                )}

                <button
                  onClick={() => handleDelete(rule.id)}
                  disabled={deletingId === rule.id}
                  className="shrink-0 text-red-400 hover:text-red-600 disabled:opacity-40 transition-colors text-sm px-2 py-1 rounded-lg hover:bg-red-50"
                >
                  {deletingId === rule.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
