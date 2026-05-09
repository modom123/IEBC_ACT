'use client'
import { useEffect, useState, useCallback } from 'react'

type Build = {
  id: string
  title: string
  client_name: string
  description: string
  status: 'planning' | 'in_progress' | 'review' | 'complete' | 'on_hold'
  priority: 'low' | 'medium' | 'high'
  progress: number
  start_date: string
  due_date: string
  assigned_to: string
  tags: string[]
  created_at: string
}

const STATUS_STYLES: Record<string, string> = {
  planning:    'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  review:      'bg-purple-100 text-purple-700',
  complete:    'bg-green-100 text-green-700',
  on_hold:     'bg-amber-100 text-amber-700',
}

const PRIORITY_STYLES: Record<string, string> = {
  low:    'bg-gray-100 text-gray-500',
  medium: 'bg-blue-100 text-blue-600',
  high:   'bg-red-100 text-red-600',
}

const TABS = ['All', 'Planning', 'In Progress', 'Review', 'Complete', 'On Hold']
const fmt = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

function ProgressBar({ value }: { value: number }) {
  const color = value >= 80 ? '#f97316' : value >= 50 ? '#3b82f6' : '#22c55e'
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, backgroundColor: color }} />
    </div>
  )
}

const emptyForm = () => ({
  title: '', client_name: '', description: '', status: 'planning' as Build['status'],
  priority: 'medium' as Build['priority'], progress: '0', start_date: '', due_date: '', assigned_to: '', tags: '',
})

export default function BuildsPage() {
  const [builds, setBuilds] = useState<Build[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('All')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hub/builds')
      const data = await res.json()
      setBuilds(Array.isArray(data) ? data : [])
    } catch { setBuilds([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = tab === 'All' ? builds : builds.filter(b => fmt(b.status) === tab)

  const dueThisWeek = builds.filter(b => {
    if (!b.due_date) return false
    const due = new Date(b.due_date), now = new Date()
    const diff = (due.getTime() - now.getTime()) / 86400000
    return diff >= 0 && diff <= 7
  }).length

  async function handleCreate() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await fetch('/api/hub/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          progress: Number(form.progress),
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      })
      setForm(emptyForm())
      setShowForm(false)
      await load()
    } finally { setSaving(false) }
  }

  async function patchBuild(id: string, patch: Record<string, unknown>) {
    setUpdatingId(id)
    try {
      await fetch('/api/hub/builds', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      await load()
    } finally { setUpdatingId(null) }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Active Builds</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track projects and builds in progress</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="bg-[#0F4C81] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#0d3d6b] transition-colors">
            {showForm ? '✕ Cancel' : '+ New Build'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Builds', value: builds.length },
            { label: 'Active', value: builds.filter(b => b.status === 'in_progress').length },
            { label: 'Due This Week', value: dueThisWeek },
            { label: 'Completed', value: builds.filter(b => b.status === 'complete').length },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
              <p className="text-3xl font-bold text-[#0F4C81] mt-1">{k.value}</p>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">New Build</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Title *', key: 'title', type: 'text', placeholder: 'Build title' },
                { label: 'Client Name', key: 'client_name', type: 'text', placeholder: 'Client or internal' },
                { label: 'Assigned To', key: 'assigned_to', type: 'text', placeholder: 'Team member' },
                { label: 'Start Date', key: 'start_date', type: 'date', placeholder: '' },
                { label: 'Due Date', key: 'due_date', type: 'date', placeholder: '' },
                { label: 'Progress %', key: 'progress', type: 'number', placeholder: '0' },
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Build['status'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 bg-white">
                  <option value="planning">Planning</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="complete">Complete</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value as Build['priority'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 bg-white">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tags (comma-separated)</label>
                <input type="text" placeholder="react, supabase, mvp" value={form.tags}
                  onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea rows={2} placeholder="What's being built…" value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreate} disabled={saving || !form.title.trim()}
                className="bg-[#0F4C81] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#0d3d6b] disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Create Build'}
              </button>
              <button onClick={() => { setShowForm(false); setForm(emptyForm()) }}
                className="px-5 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1.5 shadow-sm w-fit overflow-x-auto">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'bg-[#0F4C81] text-white' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
              {t}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-2 bg-gray-200 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-16 text-center text-gray-400 text-sm shadow-sm">
            No builds found — start tracking your first project
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(build => {
              const isExpanded = expandedId === build.id
              return (
                <div key={build.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{build.title}</p>
                        {build.client_name && <p className="text-xs text-gray-500 mt-0.5">{build.client_name}</p>}
                      </div>
                      <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[build.priority]}`}>
                        {build.priority}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_STYLES[build.status]}`}>
                        {fmt(build.status)}
                      </span>
                      {(build.tags ?? []).map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Progress</span>
                        <span className="font-medium">{build.progress}%</span>
                      </div>
                      <ProgressBar value={build.progress} />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      {build.assigned_to && <span>👤 {build.assigned_to}</span>}
                      {build.due_date && <span>📅 Due {fmtDate(build.due_date)}</span>}
                    </div>
                    <button onClick={() => setExpandedId(isExpanded ? null : build.id)}
                      className="text-xs text-[#0F4C81] hover:underline font-medium">
                      {isExpanded ? '▲ Hide' : '▼ Details & actions'}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50/60">
                      {build.description && <p className="text-xs text-gray-600">{build.description}</p>}
                      <div className="flex gap-1 items-center">
                        <span className="text-xs text-gray-500 font-medium mr-1">Progress:</span>
                        <input type="range" min={0} max={100} defaultValue={build.progress}
                          onMouseUp={e => patchBuild(build.id, { progress: Number((e.target as HTMLInputElement).value) })}
                          className="flex-1 accent-[#0F4C81]" />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {build.status !== 'complete' && (
                          <button onClick={() => patchBuild(build.id, { status: 'complete' })} disabled={updatingId === build.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium disabled:opacity-50">
                            ✓ Mark Complete
                          </button>
                        )}
                        {build.status !== 'in_progress' && build.status !== 'complete' && (
                          <button onClick={() => patchBuild(build.id, { status: 'in_progress' })} disabled={updatingId === build.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium disabled:opacity-50">
                            ▶ Start
                          </button>
                        )}
                        {build.status !== 'review' && build.status !== 'complete' && (
                          <button onClick={() => patchBuild(build.id, { status: 'review' })} disabled={updatingId === build.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 font-medium disabled:opacity-50">
                            👁 Review
                          </button>
                        )}
                        {build.status !== 'on_hold' && build.status !== 'complete' && (
                          <button onClick={() => patchBuild(build.id, { status: 'on_hold' })} disabled={updatingId === build.id}
                            className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium disabled:opacity-50">
                            ⏸ Hold
                          </button>
                        )}
                      </div>
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
