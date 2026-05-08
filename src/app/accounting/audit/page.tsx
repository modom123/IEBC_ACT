'use client'
import { useEffect, useState, useCallback } from 'react'

type AuditLog = {
  id: string
  action: string
  resource_type: string
  resource_id: string
  created_at: string
  details: Record<string, unknown> | null
  user_id: string
}

type Filters = {
  action: string
  resource: string
  from: string
  to: string
}

const ACTION_STYLES: Record<string, { bg: string; text: string; icon: string }> = {
  create: { bg: 'bg-green-100', text: 'text-green-700', icon: '✓' },
  update: { bg: 'bg-blue-100', text: 'text-blue-700', icon: '✏' },
  delete: { bg: 'bg-red-100', text: 'text-red-700', icon: '🗑' },
  login:  { bg: 'bg-purple-100', text: 'text-purple-700', icon: '→' },
  export: { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '↓' },
}

const RESOURCE_LABELS: Record<string, string> = {
  transaction: 'Transaction',
  invoice:     'Invoice',
  bill:        'Bill',
  estimate:    'Estimate',
  payroll:     'Payroll',
  tax:         'Tax',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`
  return `${Math.floor(months / 12)} year${Math.floor(months / 12) > 1 ? 's' : ''} ago`
}

function describe(log: AuditLog): string {
  const action = log.action.charAt(0).toUpperCase() + log.action.slice(1)
  const resource = RESOURCE_LABELS[log.resource_type] ?? log.resource_type
  const id = log.resource_id ? ` #${log.resource_id.slice(0, 8)}` : ''
  return `${action}d ${resource}${id}`
}

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'table_missing' | 'generic' | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [limit, setLimit] = useState(100)
  const [total, setTotal] = useState(0)

  const [filters, setFilters] = useState<Filters>({ action: '', resource: '', from: '', to: '' })
  const [applied, setApplied] = useState<Filters>({ action: '', resource: '', from: '', to: '' })

  const load = useCallback(async (f: Filters, lim: number) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (f.action)   params.set('action', f.action)
      if (f.resource) params.set('resource', f.resource)
      if (f.from)     params.set('from', f.from)
      if (f.to)       params.set('to', f.to)
      params.set('limit', String(lim))
      const res = await fetch(`/api/accounting/audit?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = (body?.error ?? body?.message ?? '').toLowerCase()
        if (msg.includes('audit_logs') || msg.includes('does not exist') || msg.includes('table')) {
          setError('table_missing')
        } else {
          setError('generic')
        }
        setLogs([])
      } else {
        const data = await res.json()
        const arr = Array.isArray(data) ? data : (data?.data ?? [])
        setLogs(arr)
        setTotal(data?.total ?? arr.length)
      }
    } catch {
      setError('generic')
      setLogs([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load(applied, limit) }, [applied, limit, load])

  const applyFilters = () => {
    setLimit(100)
    setApplied({ ...filters })
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const loadMore = () => setLimit(prev => prev + 100)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
            <p className="text-sm text-gray-500 mt-0.5">Complete activity log for compliance and review</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 border border-gray-200 bg-white text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            <span>⬆</span> Export
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Action</label>
              <select
                value={filters.action}
                onChange={e => setFilters(prev => ({ ...prev, action: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30"
              >
                <option value="">All Actions</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="login">Login</option>
                <option value="export">Export</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Resource</label>
              <select
                value={filters.resource}
                onChange={e => setFilters(prev => ({ ...prev, resource: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30"
              >
                <option value="">All Resources</option>
                <option value="transaction">Transaction</option>
                <option value="invoice">Invoice</option>
                <option value="bill">Bill</option>
                <option value="estimate">Estimate</option>
                <option value="payroll">Payroll</option>
                <option value="tax">Tax</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date From</label>
              <input
                type="date"
                value={filters.from}
                onChange={e => setFilters(prev => ({ ...prev, from: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date To</label>
              <input
                type="date"
                value={filters.to}
                onChange={e => setFilters(prev => ({ ...prev, to: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/30"
              />
            </div>
            <button
              onClick={applyFilters}
              className="bg-[#0F4C81] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#0d3d6b] transition-colors"
            >
              Apply Filters
            </button>
            {(applied.action || applied.resource || applied.from || applied.to) && (
              <button
                onClick={() => { setFilters({ action: '', resource: '', from: '', to: '' }); setApplied({ action: '', resource: '', from: '', to: '' }) }}
                className="text-sm text-gray-400 hover:text-gray-600 underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {loading && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 flex items-center justify-center text-gray-400 text-sm">
            Loading audit logs…
          </div>
        )}

        {!loading && error === 'table_missing' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
            <p className="text-amber-700 font-medium">Audit logging is not yet configured</p>
            <p className="text-amber-600 text-sm mt-1">Audit logging will be available once the audit_logs table is configured.</p>
          </div>
        )}

        {!loading && error === 'generic' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Failed to load audit logs</p>
            <p className="text-red-500 text-sm mt-1">Please try again or contact support if the issue persists.</p>
          </div>
        )}

        {!loading && !error && logs.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 flex flex-col items-center justify-center gap-2">
            <p className="text-gray-400 text-sm font-medium">No activity recorded yet</p>
            <p className="text-gray-300 text-xs">Audit entries will appear here as actions are performed</p>
          </div>
        )}

        {!loading && !error && logs.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-500 font-medium">Showing {logs.length} of {total > 0 ? total : logs.length} entries</p>
            </div>
            <div className="divide-y divide-gray-50">
              {logs.map((log, idx) => {
                const style = ACTION_STYLES[log.action] ?? { bg: 'bg-gray-100', text: 'text-gray-700', icon: '·' }
                const isExpanded = expanded.has(log.id)
                const hasDetails = log.details && Object.keys(log.details).length > 0

                return (
                  <div key={log.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full ${style.bg} flex items-center justify-center text-sm flex-shrink-0`}>
                          <span className={style.text}>{style.icon}</span>
                        </div>
                        {idx < logs.length - 1 && <div className="w-px bg-gray-100 flex-1 mt-1 min-h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md ${style.bg} ${style.text}`}>
                            {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                          </span>
                          {log.resource_type && (
                            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                              {RESOURCE_LABELS[log.resource_type] ?? log.resource_type}
                            </span>
                          )}
                          <span className="text-sm text-gray-800 font-medium">{describe(log)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-400">{timeAgo(log.created_at)}</span>
                          <span className="text-xs text-gray-300">·</span>
                          <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                          {log.user_id && (
                            <>
                              <span className="text-xs text-gray-300">·</span>
                              <span className="text-xs text-gray-400">User {log.user_id.slice(0, 8)}</span>
                            </>
                          )}
                        </div>
                        {hasDetails && (
                          <button
                            onClick={() => toggleExpand(log.id)}
                            className="mt-2 text-xs text-[#0F4C81] hover:underline font-medium"
                          >
                            {isExpanded ? '▲ Hide details' : '▼ Show details'}
                          </button>
                        )}
                        {isExpanded && hasDetails && (
                          <div className="mt-2 bg-gray-50 border border-gray-100 rounded-lg p-3">
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all font-mono">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            {logs.length >= limit && (
              <div className="px-5 py-4 border-t border-gray-100 text-center">
                <button
                  onClick={loadMore}
                  className="text-sm text-[#0F4C81] font-medium hover:underline"
                >
                  Load more
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
