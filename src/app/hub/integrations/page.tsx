'use client'
import { useEffect, useState, useCallback } from 'react'

type Integration = {
  id: string
  integration_key: string
  status: 'connected' | 'disconnected'
  notes: string
  connected_at: string
}

type CatalogItem = {
  key: string
  name: string
  description: string
  category: string
  icon: string
}

const CATALOG: CatalogItem[] = [
  { key: 'stripe',       name: 'Stripe',        description: 'Payments & subscriptions',       category: 'payments',      icon: '💳' },
  { key: 'plaid',        name: 'Plaid',         description: 'Bank account linking',            category: 'payments',      icon: '🏦' },
  { key: 'quickbooks',   name: 'QuickBooks',    description: 'Accounting & invoicing',          category: 'accounting',    icon: '📒' },
  { key: 'zapier',       name: 'Zapier',        description: 'Workflow automation',             category: 'automation',    icon: '⚡' },
  { key: 'slack',        name: 'Slack',         description: 'Team messaging & alerts',         category: 'communication', icon: '💬' },
  { key: 'google',       name: 'Google Workspace', description: 'Drive, Docs, Gmail',          category: 'productivity',  icon: '🔍' },
  { key: 'notion',       name: 'Notion',        description: 'Docs, wikis, and databases',      category: 'productivity',  icon: '📝' },
  { key: 'hubspot',      name: 'HubSpot',       description: 'CRM & marketing hub',             category: 'crm',           icon: '🎯' },
  { key: 'calendly',     name: 'Calendly',      description: 'Scheduling & bookings',           category: 'scheduling',    icon: '📅' },
  { key: 'twilio',       name: 'Twilio',        description: 'SMS, voice & messaging API',      category: 'communication', icon: '📱' },
  { key: 'mailchimp',    name: 'Mailchimp',     description: 'Email marketing campaigns',       category: 'marketing',     icon: '📧' },
  { key: 'typeform',     name: 'Typeform',      description: 'Forms, surveys & leads',          category: 'marketing',     icon: '📋' },
  { key: 'github',       name: 'GitHub',        description: 'Code repos & deployments',        category: 'dev',           icon: '🐙' },
  { key: 'vercel',       name: 'Vercel',        description: 'Frontend deployments',            category: 'dev',           icon: '▲' },
  { key: 'supabase',     name: 'Supabase',      description: 'Database & auth backend',         category: 'dev',           icon: '🗄️' },
  { key: 'anthropic',    name: 'Anthropic',     description: 'Claude AI API access',            category: 'ai',            icon: '🤖' },
]

const CATEGORIES = ['all', 'payments', 'accounting', 'automation', 'communication', 'productivity', 'crm', 'scheduling', 'marketing', 'dev', 'ai']

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [configKey, setConfigKey] = useState<string | null>(null)
  const [configNotes, setConfigNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hub/integrations')
      const data = await res.json()
      setIntegrations(Array.isArray(data) ? data : [])
    } catch { setIntegrations([]) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const statusMap = Object.fromEntries(integrations.map(i => [i.integration_key, i]))

  const filteredCatalog = categoryFilter === 'all'
    ? CATALOG
    : CATALOG.filter(c => c.category === categoryFilter)

  const connected = integrations.filter(i => i.status === 'connected').length

  async function toggleConnection(key: string) {
    const existing = statusMap[key]
    const newStatus = existing?.status === 'connected' ? 'disconnected' : 'connected'
    try {
      await fetch('/api/hub/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration_key: key,
          status: newStatus,
          notes: existing?.notes ?? '',
          connected_at: newStatus === 'connected' ? new Date().toISOString() : null,
        }),
      })
      await load()
    } catch { /* ignore */ }
  }

  async function saveNotes(key: string) {
    setSaving(true)
    try {
      await fetch('/api/hub/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          integration_key: key,
          status: statusMap[key]?.status ?? 'disconnected',
          notes: configNotes,
        }),
      })
      setConfigKey(null)
      await load()
    } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
            <p className="text-sm text-gray-500 mt-0.5">Connect your tools and track your stack</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Available', value: CATALOG.length },
            { label: 'Connected', value: connected },
            { label: 'Disconnected', value: CATALOG.length - connected },
            { label: 'Categories', value: CATEGORIES.length - 1 },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
              <p className="text-3xl font-bold text-[#0F4C81] mt-1">{k.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1.5 shadow-sm overflow-x-auto w-full">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors capitalize ${categoryFilter === c ? 'bg-[#0F4C81] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse space-y-3">
                <div className="flex gap-3"><div className="w-10 h-10 bg-gray-200 rounded-xl" /><div className="flex-1 space-y-2"><div className="h-4 bg-gray-200 rounded" /><div className="h-3 bg-gray-200 rounded w-2/3" /></div></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCatalog.map(item => {
              const record = statusMap[item.key]
              const isConnected = record?.status === 'connected'
              const isConfig = configKey === item.key

              return (
                <div key={item.key} className={`bg-white rounded-xl shadow-sm border overflow-hidden transition-all ${isConnected ? 'border-green-200' : 'border-gray-100'}`}>
                  <div className="p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl shrink-0 border border-gray-100">
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold text-gray-900 text-sm truncate">{item.name}</p>
                          {isConnected && <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{item.description}</p>
                      </div>
                    </div>

                    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">{item.category}</span>

                    {record?.connected_at && isConnected && (
                      <p className="text-xs text-gray-400">Connected {new Date(record.connected_at).toLocaleDateString()}</p>
                    )}

                    {isConfig ? (
                      <div className="space-y-2">
                        <textarea rows={2} value={configNotes} onChange={e => setConfigNotes(e.target.value)}
                          placeholder="API keys, notes, config…"
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#0F4C81]/30 resize-none" />
                        <div className="flex gap-2">
                          <button onClick={() => saveNotes(item.key)} disabled={saving}
                            className="text-xs bg-[#0F4C81] text-white px-3 py-1.5 rounded-lg font-medium hover:bg-[#0d3d6b] disabled:opacity-50">
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={() => setConfigKey(null)} className="text-xs text-gray-400 hover:text-gray-600 px-2">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => toggleConnection(item.key)}
                          className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-colors ${isConnected ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                          {isConnected ? 'Disconnect' : 'Connect'}
                        </button>
                        <button onClick={() => { setConfigKey(item.key); setConfigNotes(record?.notes ?? '') }}
                          className="text-xs px-3 py-1.5 rounded-lg bg-blue-50 text-[#0F4C81] hover:bg-blue-100 font-medium transition-colors">
                          Notes
                        </button>
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
