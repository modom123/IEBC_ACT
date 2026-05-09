'use client'
import { useEffect, useState, useCallback } from 'react'

type Client = {
  id: string
  business_name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  industry: string
  status: 'active' | 'inactive' | 'prospect' | 'churned'
  plan: string
  monthly_value: number
  start_date: string
  notes: string
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  prospect: 'bg-blue-100 text-blue-700',
  inactive: 'bg-gray-100 text-gray-500',
  churned:  'bg-red-100 text-red-600',
}

const INDUSTRIES = ['Technology','Healthcare','Finance','Retail','Real Estate','Construction','Legal','Marketing','Manufacturing','Other']
const TABS = ['All','Active','Prospect','Inactive','Churned']
const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })

const emptyForm = () => ({
  business_name: '', contact_name: '', contact_email: '', contact_phone: '',
  industry: 'Technology', status: 'active' as Client['status'],
  plan: '', monthly_value: '', start_date: '', notes: '',
})

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('All')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hub/clients')
      const data = await res.json()
      setClients(Array.isArray(data) ? data : [])
    } catch { setClients([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = clients.filter(c => {
    if (tab !== 'All' && c.status !== tab.toLowerCase()) return false
    const q = search.toLowerCase()
    return !q || c.business_name?.toLowerCase().includes(q) || c.contact_name?.toLowerCase().includes(q) || c.contact_email?.toLowerCase().includes(q)
  })

  const activeMRR = clients.filter(c => c.status === 'active').reduce((s, c) => s + Number(c.monthly_value), 0)
  const avgValue = clients.length ? clients.reduce((s, c) => s + Number(c.monthly_value), 0) / clients.length : 0

  async function handleSave() {
    if (!form.business_name.trim()) return
    setSaving(true)
    try {
      const body = { ...form, monthly_value: parseFloat(form.monthly_value as string) || 0 }
      if (editId) {
        await fetch('/api/hub/clients', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...body }) })
        setEditId(null)
      } else {
        await fetch('/api/hub/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        setShowForm(false)
      }
      setForm(emptyForm())
      await load()
    } finally { setSaving(false) }
  }

  function startEdit(c: Client) {
    setEditId(c.id)
    setForm({ business_name: c.business_name, contact_name: c.contact_name, contact_email: c.contact_email, contact_phone: c.contact_phone, industry: c.industry, status: c.status, plan: c.plan, monthly_value: String(c.monthly_value), start_date: c.start_date, notes: c.notes })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Client Directory</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage and track all your clients</p>
          </div>
          <button onClick={() => { setShowForm(v => !v); setEditId(null); setForm(emptyForm()) }}
            className="bg-[#0F4C81] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#0d3d6b] transition-colors">
            {showForm ? '✕ Cancel' : '+ Add Client'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Clients', value: clients.length },
            { label: 'Active', value: clients.filter(c => c.status === 'active').length },
            { label: 'MRR', value: fmt(activeMRR) },
            { label: 'Avg Value', value: fmt(avgValue) },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
              <p className="text-2xl font-bold text-[#0F4C81] mt-1">{k.value}</p>
            </div>
          ))}
        </div>

        {(showForm || editId) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">{editId ? 'Edit Client' : 'New Client'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Business Name *', key: 'business_name', type: 'text', placeholder: 'Acme Corp' },
                { label: 'Contact Name', key: 'contact_name', type: 'text', placeholder: 'Jane Smith' },
                { label: 'Contact Email', key: 'contact_email', type: 'email', placeholder: 'jane@acme.com' },
                { label: 'Phone', key: 'contact_phone', type: 'text', placeholder: '+1 555-0000' },
                { label: 'Plan', key: 'plan', type: 'text', placeholder: 'Gold, Platinum…' },
                { label: 'Monthly Value', key: 'monthly_value', type: 'number', placeholder: '0.00' },
                { label: 'Start Date', key: 'start_date', type: 'date', placeholder: '' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input type={f.type} placeholder={f.placeholder}
                    value={form[f.key as keyof typeof form] as string}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Industry</label>
                <select value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 bg-white">
                  {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Client['status'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 bg-white">
                  <option value="active">Active</option>
                  <option value="prospect">Prospect</option>
                  <option value="inactive">Inactive</option>
                  <option value="churned">Churned</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea rows={2} placeholder="Internal notes…" value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving || !form.business_name.trim()}
                className="bg-[#0F4C81] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#0d3d6b] disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Client'}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); setForm(emptyForm()) }}
                className="px-5 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap gap-3 items-center">
          <input type="text" placeholder="Search clients…" value={search} onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30" />
          <div className="flex gap-1">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-[#0F4C81] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded flex-1" />
                <div className="h-4 bg-gray-200 rounded w-24" />
                <div className="h-4 bg-gray-200 rounded w-20" />
              </div>
            ))}</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">No clients found — add your first client</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Business', 'Contact', 'Industry', 'Status', 'Plan', 'Monthly Value', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(c => (
                  <>
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{c.business_name}</p>
                        {c.start_date && <p className="text-xs text-gray-400">Since {new Date(c.start_date).toLocaleDateString()}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-700">{c.contact_name || '—'}</p>
                        <p className="text-xs text-gray-400">{c.contact_email || ''}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{c.industry}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${STATUS_STYLES[c.status]}`}>{c.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{c.plan || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800">{fmt(c.monthly_value)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => startEdit(c)} className="text-xs text-[#0F4C81] hover:underline font-medium">Edit</button>
                          {c.notes && (
                            <button onClick={() => setExpandedNoteId(expandedNoteId === c.id ? null : c.id)}
                              className="text-xs text-gray-400 hover:text-gray-600 font-medium">Notes</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedNoteId === c.id && c.notes && (
                      <tr key={`note-${c.id}`} className="bg-blue-50">
                        <td colSpan={7} className="px-4 py-3">
                          <p className="text-xs text-gray-600 italic">{c.notes}</p>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
