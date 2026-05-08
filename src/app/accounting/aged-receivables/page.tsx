'use client'
import { useEffect, useState, useCallback } from 'react'

type Invoice = {
  id: string
  invoice_number: string
  client_name: string
  status: string
  total: number
  amount_paid: number
  due_date: string
  created_at: string
}

type AgingBucket = {
  label: string
  key: string
  min: number
  max: number
  color: string
  headerColor: string
  badgeColor: string
  cardBg: string
  cardBorder: string
  cardText: string
}

const BUCKETS: AgingBucket[] = [
  {
    label: 'Current',
    key: 'current',
    min: -Infinity,
    max: 0,
    color: 'text-green-700',
    headerColor: 'bg-green-50 border-green-100',
    badgeColor: 'bg-green-100 text-green-700',
    cardBg: 'bg-white',
    cardBorder: 'border-green-100',
    cardText: 'text-green-600',
  },
  {
    label: '1–30 Days',
    key: '1-30',
    min: 1,
    max: 30,
    color: 'text-amber-700',
    headerColor: 'bg-amber-50 border-amber-100',
    badgeColor: 'bg-amber-100 text-amber-700',
    cardBg: 'bg-white',
    cardBorder: 'border-amber-100',
    cardText: 'text-amber-600',
  },
  {
    label: '31–60 Days',
    key: '31-60',
    min: 31,
    max: 60,
    color: 'text-orange-700',
    headerColor: 'bg-orange-50 border-orange-100',
    badgeColor: 'bg-orange-100 text-orange-700',
    cardBg: 'bg-white',
    cardBorder: 'border-orange-100',
    cardText: 'text-orange-600',
  },
  {
    label: '61–90 Days',
    key: '61-90',
    min: 61,
    max: 90,
    color: 'text-red-700',
    headerColor: 'bg-red-50 border-red-100',
    badgeColor: 'bg-red-100 text-red-700',
    cardBg: 'bg-white',
    cardBorder: 'border-red-100',
    cardText: 'text-red-600',
  },
  {
    label: '90+ Days',
    key: '90+',
    min: 91,
    max: Infinity,
    color: 'text-red-900',
    headerColor: 'bg-red-100 border-red-200',
    badgeColor: 'bg-red-200 text-red-900',
    cardBg: 'bg-white',
    cardBorder: 'border-red-200',
    cardText: 'text-red-800',
  },
]

const fmt = (n: number) =>
  '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type EnrichedInvoice = Invoice & { balance: number; daysOverdue: number }

function getBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return BUCKETS[0]
  if (daysOverdue <= 30) return BUCKETS[1]
  if (daysOverdue <= 60) return BUCKETS[2]
  if (daysOverdue <= 90) return BUCKETS[3]
  return BUCKETS[4]
}

export default function AgedReceivablesPage() {
  const [invoices, setInvoices] = useState<EnrichedInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toastId, setToastId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/accounting/invoices')
      const data = await res.json()
      const raw: Invoice[] = Array.isArray(data) ? data : []
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const enriched: EnrichedInvoice[] = raw
        .filter(inv => inv.status !== 'paid' && inv.status !== 'void')
        .map(inv => {
          const balance = Math.max(0, (inv.total ?? 0) - (inv.amount_paid ?? 0))
          const due = inv.due_date ? new Date(inv.due_date) : null
          const daysOverdue = due ? Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) : 0
          return { ...inv, balance, daysOverdue }
        })
        .filter(inv => inv.balance > 0)

      setInvoices(enriched)
    } catch {
      setError('Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalOutstanding = invoices.reduce((s, inv) => s + inv.balance, 0)

  const bucketData = BUCKETS.map(bucket => {
    const items = invoices
      .filter(inv => {
        if (bucket.key === 'current') return inv.daysOverdue <= 0
        if (bucket.key === '1-30') return inv.daysOverdue >= 1 && inv.daysOverdue <= 30
        if (bucket.key === '31-60') return inv.daysOverdue >= 31 && inv.daysOverdue <= 60
        if (bucket.key === '61-90') return inv.daysOverdue >= 61 && inv.daysOverdue <= 90
        return inv.daysOverdue >= 91
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
    const total = items.reduce((s, inv) => s + inv.balance, 0)
    return { bucket, items, total }
  })

  const showToast = (id: string) => {
    setToastId(id)
    setTimeout(() => setToastId(null), 3000)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {toastId && (
        <div className="fixed top-4 right-4 z-50 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-in slide-in-from-right">
          Reminder sent to client
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aged Receivables</h1>
          <p className="text-sm text-gray-500 mt-0.5">Outstanding invoice aging report</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 border border-gray-200 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-xl text-sm font-semibold transition"
        >
          <span>⊡</span> Export / Print
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <span>⚠</span> {error}
          <button className="ml-auto text-red-400 hover:text-red-600" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {!loading && (
        <div className="bg-[#0F4C81] rounded-xl p-5 text-white flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide">Total Outstanding Balance</p>
            <p className="text-4xl font-bold mt-1">{fmt(totalOutstanding)}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide">Open Invoices</p>
            <p className="text-3xl font-bold mt-1">{invoices.length}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-400 text-sm">Loading aged receivables…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {bucketData.map(({ bucket, items, total }) => (
              <div key={bucket.key} className={`bg-white rounded-xl shadow-sm p-4 border ${bucket.cardBorder}`}>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{bucket.label}</p>
                <p className={`text-2xl font-bold mt-1 ${bucket.cardText}`}>{items.length}</p>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">{fmt(total)}</p>
              </div>
            ))}
          </div>

          <div className="space-y-6">
            {bucketData.map(({ bucket, items, total }) => {
              if (items.length === 0) return null
              return (
                <div key={bucket.key} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className={`px-5 py-3 border-b flex items-center justify-between ${bucket.headerColor}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${bucket.badgeColor}`}>
                        {bucket.label}
                      </span>
                      <span className="text-xs text-gray-500 font-medium">{items.length} invoice{items.length !== 1 ? 's' : ''}</span>
                    </div>
                    <span className={`text-sm font-bold ${bucket.color}`}>{fmt(total)}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/60 text-xs text-gray-500 font-semibold">
                          <th className="text-left px-4 py-2.5">Invoice #</th>
                          <th className="text-left px-4 py-2.5">Client</th>
                          <th className="text-left px-4 py-2.5">Due Date</th>
                          <th className="text-right px-4 py-2.5">Total</th>
                          <th className="text-right px-4 py-2.5">Paid</th>
                          <th className="text-right px-4 py-2.5">Balance Due</th>
                          <th className="text-right px-4 py-2.5">Days Overdue</th>
                          <th className="text-right px-4 py-2.5">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {items.map(inv => (
                          <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-[#0F4C81] font-semibold">
                              {inv.invoice_number}
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-900">{inv.client_name}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">{fmt(inv.total)}</td>
                            <td className="px-4 py-3 text-right text-gray-500">{fmt(inv.amount_paid)}</td>
                            <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(inv.balance)}</td>
                            <td className="px-4 py-3 text-right">
                              {inv.daysOverdue > 0 ? (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${bucket.badgeColor}`}>
                                  {inv.daysOverdue}d
                                </span>
                              ) : (
                                <span className="text-xs text-green-600 font-semibold">Current</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => showToast(inv.id)}
                                className="text-xs px-3 py-1 rounded-lg bg-[#0F4C81]/5 text-[#0F4C81] hover:bg-[#0F4C81]/10 font-semibold transition whitespace-nowrap"
                              >
                                Send Reminder
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}

            {invoices.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-16 text-center text-gray-400 text-sm">
                No outstanding invoices — all caught up!
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
