'use client'
import { useEffect, useState, useCallback } from 'react'

type Advisor = {
  id: string
  name: string
  role: string
  specialty: string
  department: 'finance' | 'marketing' | 'operations' | 'legal' | 'hr' | 'tech' | 'strategy'
  status: 'active' | 'inactive' | 'pending'
  model: string
  tasks_completed: number
  last_active: string
  description: string
  created_at: string
}

const DEPT_STYLES: Record<string, { bg: string; text: string; avatar: string }> = {
  finance:    { bg: 'bg-green-100',  text: 'text-green-700',  avatar: 'bg-green-500' },
  marketing:  { bg: 'bg-purple-100', text: 'text-purple-700', avatar: 'bg-purple-500' },
  operations: { bg: 'bg-blue-100',   text: 'text-blue-700',   avatar: 'bg-blue-500' },
  legal:      { bg: 'bg-amber-100',  text: 'text-amber-700',  avatar: 'bg-amber-500' },
  hr:         { bg: 'bg-pink-100',   text: 'text-pink-700',   avatar: 'bg-pink-500' },
  tech:       { bg: 'bg-cyan-100',   text: 'text-cyan-700',   avatar: 'bg-cyan-500' },
  strategy:   { bg: 'bg-indigo-100', text: 'text-indigo-700', avatar: 'bg-indigo-500' },
}

const STATUS_STYLES: Record<string, string> = {
  active:   'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-500',
  pending:  'bg-amber-100 text-amber-700',
}

const DEPARTMENTS = ['finance', 'marketing', 'operations', 'legal', 'hr', 'tech', 'strategy']
const MODELS = ['Claude Opus', 'Claude Sonnet', 'Claude Haiku']
const TABS = ['All', ...DEPARTMENTS.map(d => d.charAt(0).toUpperCase() + d.slice(1))]

function initials(name: string) {
  return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const emptyForm = () => ({
  name: '', role: '', specialty: '', department: 'strategy' as Advisor['department'],
  model: 'Claude Sonnet', description: '',
})

export default function WorkforcePage() {
  const [advisors, setAdvisors] = useState<Advisor[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [configId, setConfigId] = useState<string | null>(null)
  const [configDesc, setConfigDesc] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hub/workforce')
      const data = await res.json()
      setAdvisors(Array.isArray(data) ? data : [])
    } catch { setAdvisors([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = tab === 'All' ? advisors : advisors.filter(a => a.department === tab.toLowerCase())

  async function handleCreate() {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await fetch('/api/hub/workforce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status: 'pending', tasks_completed: 0 }),
      })
      setForm(emptyForm())
      setShowForm(false)
      await load()
    } finally { setSaving(false) }
  }

  async function toggleStatus(a: Advisor) {
    setUpdatingId(a.id)
    const status = a.status === 'active' ? 'inactive' : 'active'
    try {
      await fetch('/api/hub/workforce', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: a.id, status }),
      })
      await load()
    } finally { setUpdatingId(null) }
  }

  async function saveConfig(id: string) {
    try {
      await fetch('/api/hub/workforce', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, description: configDesc }),
      })
      setConfigId(null)
      await load()
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Advisor Workforce</h1>
            <p className="text-sm text-gray-500 mt-0.5">Build and manage your AI advisory team</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="bg-[#0F4C81] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#0d3d6b] transition-colors">
            {showForm ? '✕ Cancel' : '+ Add Advisor'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Advisors', value: advisors.length },
            { label: 'Active', value: advisors.filter(a => a.status === 'active').length },
            { label: 'Tasks Completed', value: advisors.reduce((s, a) => s + (a.tasks_completed || 0), 0) },
            { label: 'Departments', value: new Set(advisors.map(a => a.department)).size },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
              <p className="text-3xl font-bold text-[#0F4C81] mt-1">{k.value}</p>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">New Advisor</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Name *', key: 'name', placeholder: 'e.g. Alex Finance' },
                { label: 'Role Title', key: 'role', placeholder: 'CFO Advisor' },
                { label: 'Specialty', key: 'specialty', placeholder: 'Financial Planning' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                  <input placeholder={f.placeholder} value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
                <select value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value as Advisor['department'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 bg-white capitalize">
                  {DEPARTMENTS.map(d => <option key={d} value={d} className="capitalize">{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                <select value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 bg-white">
                  {MODELS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Description / Instructions</label>
                <textarea rows={2} placeholder="What this advisor focuses on…" value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreate} disabled={saving || !form.name.trim()}
                className="bg-[#0F4C81] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#0d3d6b] disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Add Advisor'}
              </button>
              <button onClick={() => { setShowForm(false); setForm(emptyForm()) }}
                className="px-5 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1.5 shadow-sm overflow-x-auto w-fit">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'bg-[#0F4C81] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse space-y-3">
                <div className="flex gap-3"><div className="w-12 h-12 bg-gray-200 rounded-full" /><div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded" /><div className="h-3 bg-gray-200 rounded w-2/3" /></div></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-16 text-center text-gray-400 text-sm shadow-sm">
            No advisors configured — build your AI workforce
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(a => {
              const dept = DEPT_STYLES[a.department] ?? DEPT_STYLES.strategy
              const isConfig = configId === a.id
              return (
                <div key={a.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
                  <div className="flex gap-3">
                    <div className={`w-12 h-12 rounded-full ${dept.avatar} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      {initials(a.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{a.name}</p>
                      <p className="text-xs text-gray-500 truncate">{a.role}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${dept.bg} ${dept.text} capitalize`}>{a.department}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-[#0F4C81] font-medium">{a.model}</span>
                  </div>
                  {a.specialty && <p className="text-xs text-gray-500">⚡ {a.specialty}</p>}
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>✓ {a.tasks_completed || 0} tasks</span>
                    {a.last_active && <span>Last active {new Date(a.last_active).toLocaleDateString()}</span>}
                  </div>
                  {isConfig ? (
                    <div className="space-y-2">
                      <textarea rows={3} value={configDesc} onChange={e => setConfigDesc(e.target.value)}
                        placeholder="Advisor instructions…"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => saveConfig(a.id)} className="text-xs bg-[#0F4C81] text-white px-3 py-1.5 rounded-lg font-medium hover:bg-[#0d3d6b]">Save</button>
                        <button onClick={() => setConfigId(null)} className="text-xs text-gray-500 hover:text-gray-700 px-2">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => toggleStatus(a)} disabled={updatingId === a.id}
                        className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${a.status === 'active' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                        {updatingId === a.id ? '…' : a.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => { setConfigId(a.id); setConfigDesc(a.description || '') }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-[#0F4C81] hover:bg-blue-100 font-medium transition-colors">
                        Configure
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
