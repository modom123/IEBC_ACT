'use client'
import { useEffect, useState, useCallback } from 'react'

type Demo = {
  id: string
  title: string
  client_name: string
  demo_type: 'product_demo' | 'pitch_deck' | 'proposal' | 'walkthrough' | 'case_study'
  url: string
  status: 'draft' | 'ready' | 'presented' | 'archived'
  outcome: 'won' | 'lost' | 'follow_up' | 'pending' | ''
  presented_at: string
  notes: string
  tags: string[]
  created_at: string
}

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  product_demo: { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-300',   label: 'Product Demo' },
  pitch_deck:   { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300', label: 'Pitch Deck'   },
  proposal:     { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-300',  label: 'Proposal'     },
  walkthrough:  { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-300',  label: 'Walkthrough'  },
  case_study:   { bg: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-300',   label: 'Case Study'   },
}

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-500',
  ready:     'bg-blue-100 text-blue-700',
  presented: 'bg-purple-100 text-purple-700',
  archived:  'bg-gray-50 text-gray-400',
}

const OUTCOME_STYLES: Record<string, string> = {
  won:       'bg-green-100 text-green-700',
  lost:      'bg-red-100 text-red-600',
  follow_up: 'bg-amber-100 text-amber-700',
  pending:   'bg-gray-100 text-gray-500',
}

const TABS = ['All', 'Draft', 'Ready', 'Presented', 'Archived']
const DEMO_TYPES = ['product_demo', 'pitch_deck', 'proposal', 'walkthrough', 'case_study'] as const

const emptyForm = () => ({
  title: '',
  client_name: '',
  demo_type: 'product_demo' as Demo['demo_type'],
  url: '',
  status: 'draft' as Demo['status'],
  notes: '',
  tags: '',
})

export default function DemosPage() {
  const [demos, setDemos] = useState<Demo[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('All')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [outcomeId, setOutcomeId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hub/demos')
      const data = await res.json()
      setDemos(Array.isArray(data) ? data : [])
    } catch { setDemos([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = tab === 'All' ? demos : demos.filter(d => d.status === tab.toLowerCase())

  const presented = demos.filter(d => d.status === 'presented').length
  const won = demos.filter(d => d.outcome === 'won').length
  const winRate = presented > 0 ? Math.round((won / presented) * 100) : 0

  async function handleCreate() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await fetch('/api/hub/demos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })
      setForm(emptyForm())
      setShowForm(false)
      await load()
    } finally { setSaving(false) }
  }

  async function markPresented(id: string, outcome: string) {
    setUpdatingId(id)
    try {
      await fetch('/api/hub/demos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'presented', outcome, presented_at: new Date().toISOString() }),
      })
      setOutcomeId(null)
      await load()
    } finally { setUpdatingId(null) }
  }

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id)
    try {
      await fetch('/api/hub/demos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await load()
    } finally { setUpdatingId(null) }
  }

  async function deleteDemo(id: string) {
    try {
      await fetch('/api/hub/demos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await load()
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Demo Gallery</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage demos, decks, and proposals</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="bg-[#0F4C81] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#0d3d6b] transition-colors">
            {showForm ? '✕ Cancel' : '+ New Demo'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Demos', value: demos.length },
            { label: 'Ready', value: demos.filter(d => d.status === 'ready').length },
            { label: 'Presented', value: presented },
            { label: 'Win Rate', value: `${winRate}%` },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
              <p className="text-3xl font-bold text-[#0F4C81] mt-1">{k.value}</p>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">New Demo</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Title *', key: 'title', type: 'text', placeholder: 'Q2 Sales Deck' },
                { label: 'Client Name', key: 'client_name', type: 'text', placeholder: 'Acme Corp' },
                { label: 'Demo URL', key: 'url', type: 'url', placeholder: 'https://…' },
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select value={form.demo_type} onChange={e => setForm(p => ({ ...p, demo_type: e.target.value as Demo['demo_type'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 bg-white">
                  {DEMO_TYPES.map(t => <option key={t} value={t}>{TYPE_STYLES[t].label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Demo['status'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 bg-white">
                  <option value="draft">Draft</option>
                  <option value="ready">Ready</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tags (comma-separated)</label>
                <input type="text" placeholder="q2, enterprise, saas" value={form.tags}
                  onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea rows={2} placeholder="Context and notes…" value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreate} disabled={saving || !form.title.trim()}
                className="bg-[#0F4C81] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#0d3d6b] disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Add Demo'}
              </button>
              <button onClick={() => { setShowForm(false); setForm(emptyForm()) }}
                className="px-5 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1.5 shadow-sm w-fit">
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
                <div className="h-2 bg-gray-200 rounded-full" />
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-16 text-center text-gray-400 text-sm shadow-sm">
            No demos found — add your first demo or deck
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(demo => {
              const tStyle = TYPE_STYLES[demo.demo_type] ?? TYPE_STYLES.product_demo
              const isOutcome = outcomeId === demo.id
              return (
                <div key={demo.id} className={`bg-white rounded-xl shadow-sm border-t-4 ${tStyle.border} border border-gray-100 overflow-hidden`}>
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{demo.title}</p>
                        {demo.client_name && <p className="text-xs text-gray-500 mt-0.5">{demo.client_name}</p>}
                      </div>
                      <button onClick={() => deleteDemo(demo.id)} className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${tStyle.bg} ${tStyle.text}`}>{tStyle.label}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[demo.status]}`}>{demo.status}</span>
                      {demo.outcome && demo.outcome !== 'pending' && (
                        <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${OUTCOME_STYLES[demo.outcome]}`}>
                          {demo.outcome === 'follow_up' ? 'Follow Up' : demo.outcome}
                        </span>
                      )}
                    </div>

                    {demo.notes && <p className="text-xs text-gray-500 line-clamp-2">{demo.notes}</p>}

                    {(demo.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(demo.tags ?? []).map(tag => (
                          <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}

                    {demo.presented_at && (
                      <p className="text-xs text-gray-400">Presented {new Date(demo.presented_at).toLocaleDateString()}</p>
                    )}

                    {isOutcome ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-gray-600">Select outcome:</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { value: 'won', label: '🏆 Won', cls: 'bg-green-50 text-green-700 hover:bg-green-100' },
                            { value: 'lost', label: '❌ Lost', cls: 'bg-red-50 text-red-600 hover:bg-red-100' },
                            { value: 'follow_up', label: '🔄 Follow Up', cls: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
                            { value: 'pending', label: '⏳ Pending', cls: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
                          ].map(o => (
                            <button key={o.value} onClick={() => markPresented(demo.id, o.value)} disabled={updatingId === demo.id}
                              className={`text-xs px-2 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${o.cls}`}>
                              {o.label}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => setOutcomeId(null)} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {demo.url && (
                          <a href={demo.url} target="_blank" rel="noopener noreferrer"
                            className="flex-1 text-xs py-1.5 rounded-lg bg-blue-50 text-[#0F4C81] hover:bg-blue-100 font-medium transition-colors text-center">
                            Open Demo
                          </a>
                        )}
                        {demo.status !== 'presented' && demo.status !== 'archived' && (
                          <button onClick={() => setOutcomeId(demo.id)}
                            className="flex-1 text-xs py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium transition-colors">
                            Mark Presented
                          </button>
                        )}
                        {demo.status !== 'archived' && (
                          <button onClick={() => updateStatus(demo.id, 'archived')} disabled={updatingId === demo.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 font-medium transition-colors disabled:opacity-50">
                            Archive
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
