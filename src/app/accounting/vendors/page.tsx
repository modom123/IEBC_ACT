'use client'

import { useState, useEffect, useCallback } from 'react'
import AccountingShell from '@/components/AccountingShell'

type Vendor = {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  tin: string | null
  vendor_type: string
  is_1099: boolean
  notes: string | null
  total_paid?: number
}

const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const VENDOR_TYPES = ['vendor', 'contractor', 'supplier', 'service provider', 'other']

const emptyForm = { name: '', contact_name: '', email: '', phone: '', address: '', tin: '', vendor_type: 'vendor', is_1099: false, notes: '' }

export default function VendorsPage() {
  const [vendors,   setVendors]   = useState<Vendor[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showAdd,   setShowAdd]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [search,    setSearch]    = useState('')
  const [filter1099, setFilter1099] = useState(false)
  const [selected,  setSelected]  = useState<Vendor | null>(null)
  const [form,      setForm]      = useState(emptyForm)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/accounting/vendors')
      const data = await res.json()
      setVendors(data.vendors || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Vendor name is required.'); return }
    setSaving(true); setError('')
    try {
      const isEdit = !!(selected as Vendor & { _edit?: boolean })
      const method = isEdit ? 'PATCH' : 'POST'
      const body   = isEdit ? { id: selected!.id, ...form } : form
      const res    = await fetch('/api/accounting/vendors', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); return }
      await load()
      setShowAdd(false); setSelected(null); setForm(emptyForm)
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Delete this vendor?')) return
    await fetch('/api/accounting/vendors', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setVendors(prev => prev.filter(v => v.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  function startEdit(v: Vendor) {
    setForm({ name: v.name, contact_name: v.contact_name || '', email: v.email || '', phone: v.phone || '', address: v.address || '', tin: v.tin || '', vendor_type: v.vendor_type, is_1099: v.is_1099, notes: v.notes || '' })
    setSelected(v)
    setShowAdd(true)
  }

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase()
    const matchSearch = !q || v.name.toLowerCase().includes(q) || (v.contact_name || '').toLowerCase().includes(q) || (v.email || '').toLowerCase().includes(q)
    return matchSearch && (!filter1099 || v.is_1099)
  })

  const total1099   = vendors.filter(v => v.is_1099).length
  const totalPaid   = vendors.reduce((s, v) => s + (v.total_paid || 0), 0)
  const need1099    = vendors.filter(v => v.is_1099 && (v.total_paid || 0) >= 600).length

  return (
    <AccountingShell>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Vendors &amp; 1099</h1>
            <p className="text-sm text-gray-400 mt-0.5">Track vendors, contractors, and 1099 filing obligations</p>
          </div>
          <button onClick={() => { setShowAdd(true); setSelected(null); setForm(emptyForm) }}
            className="px-4 py-2 bg-[#0F4C81] hover:bg-[#082D4F] text-white text-sm font-semibold rounded-lg transition">
            + Add Vendor
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Vendors',    value: String(vendors.length),  color: 'text-[#0F4C81]' },
            { label: '1099 Contractors', value: String(total1099),       color: 'text-purple-700' },
            { label: 'Total Paid YTD',   value: fmt(totalPaid),          color: 'text-green-700' },
            { label: 'Need 1099 (≥$600)', value: String(need1099),       color: need1099 > 0 ? 'text-red-600' : 'text-gray-400' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* 1099 Alert */}
        {need1099 > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 flex items-center justify-between">
            <span>⚠️ <strong>{need1099}</strong> contractor{need1099 > 1 ? 's have' : ' has'} been paid $600+ and may require a 1099-NEC filing.</span>
            <span className="text-xs font-semibold text-amber-700">Due Jan 31</span>
          </div>
        )}

        {/* Add / Edit Form */}
        {showAdd && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-4">{selected ? 'Edit Vendor' : 'New Vendor'}</h2>
            {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
            <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Vendor / Business Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Acme Corp" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Contact Name</label>
                <input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} placeholder="Jane Smith" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="vendor@example.com" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
                <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="(555) 000-0000" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Tax ID / TIN (EIN or SSN)</label>
                <input value={form.tin} onChange={e => setForm(p => ({ ...p, tin: e.target.value }))} placeholder="XX-XXXXXXX" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Vendor Type</label>
                <select value={form.vendor_type} onChange={e => setForm(p => ({ ...p, vendor_type: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]">
                  {VENDOR_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="123 Main St, Houston TX 77001" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={form.is_1099} onChange={e => setForm(p => ({ ...p, is_1099: e.target.checked }))} className="w-4 h-4 accent-[#0F4C81]" />
                  <span className="text-sm font-medium text-gray-700">Requires 1099</span>
                </label>
              </div>
              <div className="sm:col-span-2 lg:col-span-3 flex gap-2 pt-1">
                <button type="submit" disabled={saving} className="px-5 py-2 bg-[#0F4C81] hover:bg-[#082D4F] text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                  {saving ? 'Saving…' : selected ? 'Update Vendor' : 'Add Vendor'}
                </button>
                <button type="button" onClick={() => { setShowAdd(false); setSelected(null); setForm(emptyForm) }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search + Filter */}
        <div className="flex flex-wrap gap-3 items-center">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors…"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
          <button onClick={() => setFilter1099(v => !v)}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition ${filter1099 ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-600 hover:border-[#0F4C81]'}`}>
            1099 Only
          </button>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} vendor{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Table */}
        {!loading && vendors.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⬡</span>
            </div>
            <h3 className="font-bold text-gray-800 text-lg mb-2">No vendors yet</h3>
            <p className="text-gray-400 text-sm mb-6">Add vendors and contractors to track payments and 1099 obligations.</p>
            <button onClick={() => setShowAdd(true)} className="px-5 py-2 bg-[#0F4C81] text-white text-sm font-semibold rounded-lg transition hover:bg-[#082D4F]">+ Add First Vendor</button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-400 uppercase border-b border-gray-100">
                    <th className="px-4 py-3 text-left font-medium">Vendor</th>
                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Type</th>
                    <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Contact</th>
                    <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">TIN</th>
                    <th className="px-4 py-3 text-center font-medium">1099</th>
                    <th className="px-4 py-3 text-right font-medium">Total Paid</th>
                    <th className="px-4 py-3 text-center font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800">{v.name}</p>
                        {v.email && <p className="text-xs text-gray-400">{v.email}</p>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500 capitalize">{v.vendor_type}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">{v.contact_name || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 hidden lg:table-cell">{v.tin || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {v.is_1099
                          ? <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">1099</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-gray-800">
                        {v.total_paid ? fmt(v.total_paid) : '—'}
                        {v.is_1099 && (v.total_paid || 0) >= 600 && (
                          <span className="ml-1 text-[10px] text-red-500 font-bold">FILE</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => startEdit(v)} className="p-1.5 text-gray-400 hover:text-[#0F4C81] hover:bg-blue-50 rounded transition">✎</button>
                          <button onClick={() => remove(v.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition">✕</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={5} className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">Total</td>
                    <td className="px-4 py-2.5 text-right font-bold text-sm text-gray-800">{fmt(filtered.reduce((s, v) => s + (v.total_paid || 0), 0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* 1099 Guide */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <h3 className="font-bold text-[#0F4C81] mb-2 text-sm">1099-NEC Filing Guide</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-blue-700">
            <div><strong>Who gets one?</strong> Any contractor, freelancer, or unincorporated business paid $600+ during the tax year.</div>
            <div><strong>Deadline:</strong> File with the IRS and send to contractors by January 31 of the following year.</div>
            <div><strong>What you need:</strong> Contractor's legal name, address, and TIN (SSN or EIN) — collect via W-9 before paying.</div>
          </div>
        </div>
      </div>
    </AccountingShell>
  )
}
