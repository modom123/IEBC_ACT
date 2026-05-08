'use client'
import { useEffect, useState, useCallback } from 'react'

type Post = {
  id: string
  platform: 'linkedin' | 'twitter' | 'instagram' | 'facebook' | 'tiktok'
  content: string
  status: 'draft' | 'scheduled' | 'published' | 'archived'
  scheduled_at: string
  published_at: string
  engagement_score: number
  tags: string[]
  created_at: string
}

const PLATFORM_STYLES: Record<string, { bg: string; text: string; limit: number }> = {
  linkedin:  { bg: 'bg-blue-100',   text: 'text-blue-700',   limit: 3000  },
  twitter:   { bg: 'bg-sky-100',    text: 'text-sky-700',    limit: 280   },
  instagram: { bg: 'bg-pink-100',   text: 'text-pink-700',   limit: 2200  },
  facebook:  { bg: 'bg-indigo-100', text: 'text-indigo-700', limit: 63206 },
  tiktok:    { bg: 'bg-gray-100',   text: 'text-gray-700',   limit: 2200  },
}

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-500',
  scheduled: 'bg-amber-100 text-amber-700',
  published: 'bg-green-100 text-green-700',
  archived:  'bg-red-50 text-red-400',
}

const PLATFORM_ICONS: Record<string, string> = {
  linkedin: '💼', twitter: '🐦', instagram: '📸', facebook: '👥', tiktok: '🎵',
}

const TABS = ['All', 'Draft', 'Scheduled', 'Published', 'Archived']
const PLATFORMS = ['linkedin', 'twitter', 'instagram', 'facebook', 'tiktok'] as const

const emptyForm = () => ({
  platform: 'linkedin' as Post['platform'],
  content: '',
  status: 'draft' as Post['status'],
  scheduled_at: '',
  tags: '',
})

export default function SocialPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('All')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hub/social')
      const data = await res.json()
      setPosts(Array.isArray(data) ? data : [])
    } catch { setPosts([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = posts.filter(p => {
    if (tab !== 'All' && p.status !== tab.toLowerCase()) return false
    if (platformFilter !== 'all' && p.platform !== platformFilter) return false
    return true
  })

  const published = posts.filter(p => p.status === 'published').length
  const scheduled = posts.filter(p => p.status === 'scheduled').length
  const publishedPosts = posts.filter(p => p.status === 'published')
  const avgEngagement = publishedPosts.length > 0
    ? Math.round(publishedPosts.reduce((s, p) => s + (p.engagement_score || 0), 0) / publishedPosts.length)
    : 0

  async function handleCreate() {
    if (!form.content.trim()) return
    setSaving(true)
    try {
      await fetch('/api/hub/social', {
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

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id)
    try {
      await fetch('/api/hub/social', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await load()
    } finally { setUpdatingId(null) }
  }

  async function deletePost(id: string) {
    try {
      await fetch('/api/hub/social', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await load()
    } catch { /* ignore */ }
  }

  const limit = PLATFORM_STYLES[form.platform]?.limit ?? 3000
  const charCount = form.content.length
  const charPct = Math.min(100, (charCount / limit) * 100)
  const charColor = charPct > 90 ? 'text-red-500' : charPct > 70 ? 'text-amber-500' : 'text-gray-400'

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Social Media Planner</h1>
            <p className="text-sm text-gray-500 mt-0.5">Plan, schedule, and track your social content</p>
          </div>
          <button onClick={() => setShowForm(v => !v)}
            className="bg-[#0F4C81] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#0d3d6b] transition-colors">
            {showForm ? '✕ Cancel' : '+ New Post'}
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Posts', value: posts.length },
            { label: 'Published', value: published },
            { label: 'Scheduled', value: scheduled },
            { label: 'Avg Engagement', value: `${avgEngagement}%` },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
              <p className="text-3xl font-bold text-[#0F4C81] mt-1">{k.value}</p>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="text-base font-semibold text-gray-800">New Post</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Platform</label>
                <select value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value as Post['platform'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 bg-white">
                  {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_ICONS[p]} {p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as Post['status'] }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 bg-white">
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Schedule Date</label>
                <input type="datetime-local" value={form.scheduled_at}
                  onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30" />
              </div>
              <div className="sm:col-span-3">
                <div className="flex justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">Content *</label>
                  <span className={`text-xs font-medium ${charColor}`}>{charCount}/{limit}</span>
                </div>
                <textarea rows={4} placeholder="Write your post content…" value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30 resize-none" />
                <div className="mt-1 bg-gray-100 rounded-full h-1">
                  <div className={`h-1 rounded-full transition-all ${charPct > 90 ? 'bg-red-400' : charPct > 70 ? 'bg-amber-400' : 'bg-green-400'}`}
                    style={{ width: `${charPct}%` }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tags (comma-separated)</label>
                <input type="text" placeholder="marketing, launch, product" value={form.tags}
                  onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreate} disabled={saving || !form.content.trim()}
                className="bg-[#0F4C81] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#0d3d6b] disabled:opacity-50 transition-colors">
                {saving ? 'Saving…' : 'Add Post'}
              </button>
              <button onClick={() => { setShowForm(false); setForm(emptyForm()) }}
                className="px-5 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">Cancel</button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1.5 shadow-sm overflow-x-auto">
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? 'bg-[#0F4C81] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1.5 shadow-sm">
            <button onClick={() => setPlatformFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${platformFilter === 'all' ? 'bg-[#0F4C81] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              All
            </button>
            {PLATFORMS.map(p => (
              <button key={p} onClick={() => setPlatformFilter(p)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${platformFilter === p ? 'bg-[#0F4C81] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {PLATFORM_ICONS[p]}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-12 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 py-16 text-center text-gray-400 text-sm shadow-sm">
            No posts found — start planning your social content
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(post => {
              const pStyle = PLATFORM_STYLES[post.platform]
              return (
                <div key={post.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${pStyle.bg} ${pStyle.text} capitalize`}>
                        {PLATFORM_ICONS[post.platform]} {post.platform}
                      </span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES[post.status]}`}>
                        {post.status}
                      </span>
                    </div>
                    <button onClick={() => deletePost(post.id)} className="text-gray-300 hover:text-red-400 text-xs shrink-0">✕</button>
                  </div>

                  <p className="text-sm text-gray-700 line-clamp-3">{post.content}</p>

                  {post.engagement_score > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Engagement</span>
                        <span className="font-medium">{post.engagement_score}%</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-[#0F4C81] transition-all" style={{ width: `${Math.min(100, post.engagement_score)}%` }} />
                      </div>
                    </div>
                  )}

                  {(post.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {(post.tags ?? []).map(tag => (
                        <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">#{tag}</span>
                      ))}
                    </div>
                  )}

                  {post.scheduled_at && (
                    <p className="text-xs text-gray-400">📅 {new Date(post.scheduled_at).toLocaleString()}</p>
                  )}

                  <div className="flex gap-2">
                    {post.status === 'draft' && (
                      <button onClick={() => updateStatus(post.id, 'scheduled')} disabled={updatingId === post.id}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium disabled:opacity-50 transition-colors">
                        Schedule
                      </button>
                    )}
                    {post.status === 'scheduled' && (
                      <button onClick={() => updateStatus(post.id, 'published')} disabled={updatingId === post.id}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-medium disabled:opacity-50 transition-colors">
                        Publish
                      </button>
                    )}
                    {post.status !== 'archived' && (
                      <button onClick={() => updateStatus(post.id, 'archived')} disabled={updatingId === post.id}
                        className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 font-medium disabled:opacity-50 transition-colors">
                        Archive
                      </button>
                    )}
                    {post.status === 'archived' && (
                      <button onClick={() => updateStatus(post.id, 'draft')} disabled={updatingId === post.id}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium disabled:opacity-50 transition-colors">
                        Restore
                      </button>
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
