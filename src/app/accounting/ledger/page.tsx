'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type LedgerEntry = {
  id: string
  date: string
  source: 'transaction' | 'bill'
  description: string
  vendor: string
  category: string
  entryType: 'income' | 'expense' | 'transfer' | 'bill_unpaid' | 'bill_paid' | 'bill_overdue' | 'bill_void'
  amount: number
  status?: string
  balance: number | null
}

const fmt = (n: number) => '$' + Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2 })

const SOURCE_LABEL: Record<string, string> = {
  transaction: 'Transaction',
  bill:        'Bill',
}

const ENTRY_COLOR: Record<string, string> = {
  income:       'bg-green-100 text-green-700',
  expense:      'bg-red-100 text-red-700',
  transfer:     'bg-blue-100 text-blue-700',
  bill_unpaid:  'bg-orange-100 text-orange-700',
  bill_paid:    'bg-gray-100 text-gray-600',
  bill_overdue: 'bg-red-100 text-red-700',
  bill_void:    'bg-gray-50 text-gray-400',
}

const ENTRY_LABEL: Record<string, string> = {
  income:       'Income',
  expense:      'Expense',
  transfer:     'Transfer',
  bill_unpaid:  'Bill (Unpaid)',
  bill_paid:    'Bill (Paid)',
  bill_overdue: 'Bill (Overdue)',
  bill_void:    'Bill (Void)',
}

function TableSkeleton() {
  return (
    <div className="p-6 space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-4 animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-4 bg-gray-200 rounded w-28" />
          <div className="h-4 bg-gray-200 rounded flex-1" />
          <div className="h-4 bg-gray-200 rounded w-24" />
          <div className="h-4 bg-gray-200 rounded w-20" />
        </div>
      ))}
    </div>
  )
}

export default function LedgerPage() {
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSource, setFilterSource] = useState<'all' | 'transaction' | 'bill'>('all')

  useEffect(() => {
    Promise.all([
      fetch('/api/accounting/transactions').then(r => r.json()),
      fetch('/api/accounting/bills').then(r => r.json()),
    ]).then(([txs, bills]) => {
      const txEntries = (Array.isArray(txs) ? txs : []).map((t: {
        id: string; date: string; description: string; vendor?: string; category?: string; type: string; amount: number; reconciled?: boolean
      }) => ({
        id: 'tx-' + t.id,
        date: t.date,
        source: 'transaction' as const,
        description: t.description,
        vendor: t.vendor || '',
        category: t.category || '',
        entryType: t.type as LedgerEntry['entryType'],
        amount: t.amount,
        status: t.reconciled ? 'reconciled' : undefined,
        balance: null,
      }))

      const billEntries = (Array.isArray(bills) ? bills : []).map((b: {
        id: string; due_date: string; description?: string; vendor_name: string; category?: string; status: string; amount: number
      }) => ({
        id: 'bill-' + b.id,
        date: b.due_date,
        source: 'bill' as const,
        description: b.description || b.vendor_name,
        vendor: b.vendor_name,
        category: b.category || '',
        entryType: `bill_${b.status}` as LedgerEntry['entryType'],
        amount: b.amount,
        status: b.status,
        balance: null,
      }))

      // Sort all entries by date ascending to compute running balance
      const all = [...txEntries, ...billEntries].sort((a, b) =>
        a.date.localeCompare(b.date) || a.source.localeCompare(b.source)
      )

      // Running balance: income = +, expense = -, bill_paid/overdue = - (cash out), unpaid = pending
      let bal = 0
      const withBalance = all.map(e => {
        if (e.entryType === 'income')                         bal += Number(e.amount)
        else if (e.entryType === 'expense')                   bal -= Number(e.amount)
        else if (e.entryType === 'bill_paid' || e.entryType === 'bill_overdue') bal -= Number(e.amount)
        const isPending = e.entryType === 'bill_unpaid'
        return { ...e, balance: isPending ? null : bal }
      })

      setEntries(withBalance)
      setLoading(false)
    })
  }, [])

  const visible = filterSource === 'all' ? entries : entries.filter(e => e.source === filterSource)

  const totalIncome      = entries.filter(e => e.entryType === 'income').reduce((s, e) => s + Number(e.amount), 0)
  const totalExpenses    = entries.filter(e => e.entryType === 'expense').reduce((s, e) => s + Number(e.amount), 0)
  const totalBillsPaid   = entries.filter(e => e.entryType === 'bill_paid' || e.entryType === 'bill_overdue').reduce((s, e) => s + Number(e.amount), 0)
  const totalBillsUnpaid = entries.filter(e => e.entryType === 'bill_unpaid').reduce((s, e) => s + Number(e.amount), 0)
  const cashBalance      = totalIncome - totalExpenses - totalBillsPaid
  const effectiveNet     = cashBalance - totalBillsUnpaid

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/accounting" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <span className="text-gray-300" aria-hidden="true">|</span>
          <h1 className="font-bold text-gray-800">General Ledger</h1>
        </div>
        <div className="flex gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-green-400 rounded-full" />Income</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-red-400 rounded-full" />Expense</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-orange-400 rounded-full" />Bill (Unpaid)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-gray-400 rounded-full" />Bill (Paid)</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 space-y-4">

        {/* KPI Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3" role="region" aria-label="Ledger summary">
          <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Total Income</p>
            <p className="text-lg font-bold text-green-600 mt-1">{fmt(totalIncome)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Tx Expenses</p>
            <p className="text-lg font-bold text-red-600 mt-1">{fmt(totalExpenses)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-200 text-center">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Bills Paid</p>
            <p className="text-lg font-bold text-red-500 mt-1">{fmt(totalBillsPaid)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-orange-200 text-center">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Bills Unpaid</p>
            <p className="text-lg font-bold text-orange-500 mt-1">{fmt(totalBillsUnpaid)}</p>
          </div>
          <div className={`bg-white p-4 rounded-xl border-2 text-center ${cashBalance >= 0 ? 'border-green-300' : 'border-red-300'}`}>
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Cash Balance</p>
            <p className={`text-lg font-bold mt-1 ${cashBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(cashBalance)}</p>
          </div>
        </div>

        {/* Effective net after bills */}
        {totalBillsUnpaid > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700 flex justify-between items-center">
            <span>
              Cash balance <strong>{fmt(cashBalance)}</strong> — paying all unpaid bills ({fmt(totalBillsUnpaid)}) leaves effective net: <strong className={effectiveNet >= 0 ? 'text-green-700' : 'text-red-700'}>{fmt(effectiveNet)}</strong>
            </span>
            <Link href="/accounting/bills" className="font-semibold hover:underline whitespace-nowrap ml-4">Manage Bills →</Link>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2">
          {([['all', 'All Entries'], ['transaction', 'Transactions Only'], ['bill', 'Bills Only']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilterSource(val)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition min-h-[36px] ${filterSource === val ? 'bg-[#0F4C81] text-white' : 'bg-white border border-gray-200 hover:border-[#0F4C81] text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <TableSkeleton />
          ) : visible.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4" aria-hidden="true">
                <span className="text-3xl">📒</span>
              </div>
              <p className="font-semibold text-gray-700 mb-1">No ledger entries yet</p>
              <p className="text-sm text-gray-400 mb-5">Add transactions and bills to build your general ledger.</p>
              <div className="flex gap-3 justify-center">
                <Link href="/accounting/transactions" className="btn-primary text-sm">Add Transaction</Link>
                <Link href="/accounting/bills" className="btn-secondary text-sm">Add Bill</Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
                    <th className="p-3 text-left">Date</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">Description</th>
                    <th className="p-3 text-left">Vendor</th>
                    <th className="p-3 text-left">Category</th>
                    <th className="p-3 text-right">Debit (Out)</th>
                    <th className="p-3 text-right">Credit (In)</th>
                    <th className="p-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visible.map(e => {
                    const isIncome  = e.entryType === 'income'
                    const isPending = e.entryType === 'bill_unpaid'
                    const isVoid    = e.entryType === 'bill_void'
                    const debit  = !isIncome && !isVoid ? Number(e.amount) : 0
                    const credit = isIncome ? Number(e.amount) : 0

                    return (
                      <tr key={e.id} className={`hover:bg-gray-50 ${isPending ? 'opacity-75' : ''} ${isVoid ? 'opacity-50 line-through' : ''}`}>
                        <td className="p-3 text-gray-500 whitespace-nowrap">{e.date}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ENTRY_COLOR[e.entryType] || 'bg-gray-100 text-gray-600'}`}>
                            {ENTRY_LABEL[e.entryType] || e.entryType}
                          </span>
                        </td>
                        <td className="p-3 font-medium max-w-[160px] truncate">{e.description}</td>
                        <td className="p-3 text-gray-500">{e.vendor || '—'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{e.category || 'Uncategorized'}</span>
                        </td>
                        <td className="p-3 text-right font-mono text-red-600">
                          {debit > 0 ? fmt(debit) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="p-3 text-right font-mono text-green-600">
                          {credit > 0 ? fmt(credit) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="p-3 text-right font-mono font-semibold">
                          {isPending ? (
                            <span className="text-orange-400 text-xs italic">(pending)</span>
                          ) : isVoid ? (
                            <span className="text-gray-300 text-xs">—</span>
                          ) : e.balance !== null ? (
                            <span className={Number(e.balance) >= 0 ? 'text-green-700' : 'text-red-700'}>
                              {fmt(e.balance)}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-bold text-sm">
                    <td colSpan={5} className="p-3 text-gray-700">
                      Grand Total — {visible.length} entries
                    </td>
                    <td className="p-3 text-right font-mono text-red-700">
                      {fmt(totalExpenses + totalBillsPaid + totalBillsUnpaid)}
                    </td>
                    <td className="p-3 text-right font-mono text-green-700">
                      {fmt(totalIncome)}
                    </td>
                    <td className={`p-3 text-right font-mono ${cashBalance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {fmt(cashBalance)}
                    </td>
                  </tr>
                  {totalBillsUnpaid > 0 && (
                    <tr className="bg-orange-50 border-t border-orange-200 text-sm">
                      <td colSpan={7} className="p-3 text-orange-700 italic">
                        Effective net after all pending bills ({fmt(totalBillsUnpaid)})
                      </td>
                      <td className={`p-3 text-right font-mono font-bold ${effectiveNet >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {fmt(effectiveNet)}
                      </td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* How the ledger works */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 text-sm text-blue-800 space-y-2">
          <p className="font-bold">How the General Ledger works</p>
          <ul className="space-y-1 list-disc list-inside text-blue-700">
            <li><strong>Transactions</strong> (income &amp; expenses) are recorded cash flows — money in or out.</li>
            <li><strong>Bills (Paid)</strong> are bills you&apos;ve marked as paid — they reduce your cash balance.</li>
            <li><strong>Bills (Unpaid)</strong> are outstanding obligations — shown as <em>pending</em> and don&apos;t reduce balance until paid.</li>
            <li>The <strong>Running Balance</strong> tracks your actual cash position over time.</li>
            <li>The <strong>Effective Net</strong> shows what&apos;s left after all pending bills are paid.</li>
          </ul>
        </div>

      </div>
    </main>
  )
}
