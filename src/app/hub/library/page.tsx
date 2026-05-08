'use client'
import { useEffect, useState, useCallback } from 'react'

type Resource = {
  id: string
  title: string
  description: string
  category: 'template' | 'guide' | 'sop' | 'report' | 'link' | 'video'
  file_url: string
  file_type: string
  tags: string[]
  download_count: number
  featured: boolean
  created_at: string
}

const CATEGORY_STYLES: Record<string, string> = {
  template: 'bg-blue-100 text-blue-700',
  guide:    'bg-green-100 text-green-700',
  sop:      'bg-purple-100 text-purple-700',
  report:   'bg-amber-100 text-amber-700',
  link:     'bg-gray-100 text-gray-600',
  video:    'bg-pink-100 text-pink-700',
}

const FILE_ICONS: Record<string, string> = {
  template: '📝', guide: '📄', sop: '📋', report: '📊', link: '🔗', video: '🎬',
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most Downloaded' },
  { value: 'featured', label: 'Featured First' },
]

const CATEGORIES = ['template', 'guide', 'sop', 'report', 'link', 'video'] as const

const emptyForm = () => ({
  title: '',
  description: '',
  category: 'template' as Resource['category'],
  file_url: '',
  file_type: '',
  tags: '',
  featured: false,
})

export default function LibraryPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sort, setSort] = useState('newest')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hub/library')
      const data = await res.json()
      setResources(Array.isArray(data) ? data : [])
    } catch { setResources([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = resources
    .filter(r => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false
      const q = search.toLowerCase()
      return !q || r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q) || (r.tags ?? []).some(t => t.toLowerCase().includes(q))
    })
    .sort((a, b) => {
      if (sort === 'popular') return (b.download_count || 0) - (a.download_count || 0)
      if (sort === 'featured') return (b.featured ? 1 : 0) - (a.featured ? 1 : 0)
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  const totalDownloads = resources.reduce((s, r) => s + (r.download_count || 0), 0)
  const featuredCount = resources.filter(r => r.featured).length

  async function handleCreate() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      await fetch('/api/hub/library', {
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

  async function handleOpen(r: Resource) {
    if (r.file_url) {
      window.open(r.file_url, '_blank', 'noopener,noreferrer')
      try {
        await fetch('/api/hub/library', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: r.id, increment_downloads: true }),
        })
        await load()
      } catch { /* ignore */ }
    }
  }

  async function toggleFeatured(r: Resource) {
    try {
      await fetch('/api/hub/library', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, featured: !r.featured }),
      })
      await load()
    } catch { /* ignore */ }
  }

  async function deleteResource(id: string) {
    try {
      await fetch('/api/hub/library', {
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
            <h1 className="text-2xl font-bold text-gray-900">Resource Library</h1>
            <p className="text-sm text-gray-500 mt-0.5">Templates, guides, SOPs, and more</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="bg-[#0F4C81] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#0d3d6b] transition-colors">
            {showForm ? '✕ Cancel' : '+ Add Resource'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Resources', value: resources.length },
            { label: 'Featured', value: featuredCount },
            { label: 'Total Downloads', value: totalDownloads },
            { label: 'Categories', value: new Set(resources.map(r => r.category)).size },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
              <p className="text-3xl font-bold text-[#0F4C81] mt-1">{k.value}</p>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">Add Resource</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Title *', key: 'title', type: 'text', placeholder: 'Client Onboarding Template' },
                { label: 'File / Link URL', key: 'file_url', type: 'url', placeholder: 'https://…' },
                { label: 'File Type', key: 'file_type', type: 'text', placeholder: 'PDF, DOCX, Notion…' },
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
                <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as Resource['category'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 bg-white capitalize">
                  {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tags (comma-separated)</label>
                <input type="text" placeholder="finance, onboarding, client" value={form.tags}
                  onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30" />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="featured" checked={form.featured}
                  onChange={e => setForm(p => ({ ...p, featured: e.target.checked }))}
                  className="w-4 h-4 accent-[#0F4C81]" />
                <label htmlFor="featured" className="text-sm text-gray-600 cursor-pointer">Mark as Featured</label>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea rows={2} placeholder="What is this resource for…" value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreate} disabled={saving || !form.title.trim()}
                className="bg-[#0F4C81] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#0d3d6b] disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Add Resource'}
              </button>
              <button onClick={() => { setShowForm(false); setForm(emptyForm()) }}
                className="px-5 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center">
          <input type="text" placeholder="Search resources…" value={search} onChange={e => setSearch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30" />
          <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1.5 shadow-sm overflow-x-auto">
            <button onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${categoryFilter === 'all' ? 'bg-[#0F4C81] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              All
            </button>
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategoryFilter(c)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors capitalize ${categoryFilter === c ? 'bg-[#0F4C81] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {FILE_ICONS[c]} {c}
              </button>
            ))}
          </div>
          <select value={sort} onChange={e => setSort(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30">
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse space-y-3">
                <div className="h-5 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-16 text-center text-gray-400 text-sm shadow-sm">
            No resources found — add your first template or guide
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(r => (
              <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-2xl shrink-0">{FILE_ICONS[r.category]}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{r.title}</p>
                      {r.file_type && <p className="text-xs text-gray-400">{r.file_type}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleFeatured(r)} title={r.featured ? 'Unfeature' : 'Feature'}
                      className={`text-lg transition-colors ${r.featured ? 'text-amber-400 hover:text-amber-500' : 'text-gray-200 hover:text-amber-300'}`}>
                      ★
                    </button>
                    <button onClick={() => deleteResource(r.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${CATEGORY_STYLES[r.category]}`}>{r.category}</span>
                  {r.featured && <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600">Featured</span>}
                </div>

                {r.description && <p className="text-xs text-gray-500 line-clamp-2">{r.description}</p>}

                {(r.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(r.tags ?? []).map(tag => (
                      <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">⬇ {r.download_count || 0} downloads</span>
                  {r.file_url && (
                    <button onClick={() => handleOpen(r)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#0F4C81] text-white hover:bg-[#0d3d6b] font-medium transition-colors">
                      Open
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
