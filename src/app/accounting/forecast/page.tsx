'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CashFlowLine } from '@/components/Charts'

type Baseline = { avg_monthly_income: number; avg_monthly_expense: number }
type ForecastWeek = {
  week: number; label: string; from: string; to: string
  projected_income: number; projected_expense: number; net: number
  bills_due: number; recurring_income: number; recurring_expense: number
}
type ForecastData = { baseline: Baseline; forecast: ForecastWeek[] }

const fmt = (n: number) => '$' + Math.abs(Number(n)).toLocaleString('en-US', { minimumFractionDigits: 2 })

function NetCell({ value }: { value: number }) {
  return <span className={`font-semibold ${value >= 0 ? 'text-green-600' : 'text-red-600'}`}>{value < 0 ? '-' : ''}{fmt(value)}</span>
}

export default function ForecastPage() {
  const [data, setData] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const generatedAt = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  useEffect(() => {
    fetch('/api/accounting/cash-forecast')
      .then(async r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => {
        if (!d?.baseline || !Array.isArray(d.forecast) || d.forecast.length === 0)
          setFetchError('No forecast data available yet. Add transactions to generate projections.')
        else setData(d)
        setLoading(false)
      })
      .catch(() => { setFetchError('Unable to load forecast. Please try again.'); setLoading(false) })
  }, [])

  const totalNet = data?.forecast.reduce((s, w) => s + Number(w.net), 0) ?? 0
  const totalIncome = data?.forecast.reduce((s, w) => s + Number(w.projected_income), 0) ?? 0
  const totalExpense = data?.forecast.reduce((s, w) => s + Number(w.projected_expense), 0) ?? 0
  const totalBills = data?.forecast.reduce((s, w) => s + Number(w.bills_due), 0) ?? 0

  const cumulativePoints = data
    ? data.forecast.reduce<{ label: string; net: number }[]>((acc, w, i) => {
        acc.push({ label: `W${w.week}`, net: (i === 0 ? 0 : acc[i-1].net) + Number(w.net) })
        return acc
      }, [])
    : []

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Link href="/accounting" className="text-gray-400 hover:text-gray-600 text-sm">← Dashboard</Link>
          <span className="text-gray-300">|</span>
          <div>
            <h1 className="font-bold text-gray-800">13-Week Cash Flow Forecast</h1>
            <p className="text-xs text-gray-400">Generated: {generatedAt}</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse h-28" />)}
          </div>
        )}

        {!loading && fetchError && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-16 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><span className="text-3xl">⌛</span></div>
            <h2 className="font-bold text-gray-700 text-lg mb-2">Forecast Unavailable</h2>
            <p className="text-sm text-gray-400 max-w-sm mx-auto">{fetchError}</p>
          </div>
        )}

        {!loading && data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Avg Monthly Income</p>
                <p className="text-2xl font-bold text-green-600">{fmt(data.baseline.avg_monthly_income)}</p>
                <p className="text-xs text-gray-400 mt-1">90-day average</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Avg Monthly Expense</p>
                <p className="text-2xl font-bold text-red-600">{fmt(data.baseline.avg_monthly_expense)}</p>
                <p className="text-xs text-gray-400 mt-1">90-day average</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Projected 13-Week Net</p>
                <p className={`text-2xl font-bold ${totalNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{totalNet < 0 ? '-' : ''}{fmt(totalNet)}</p>
                <p className="text-xs text-gray-400 mt-1">Sum of all weeks</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100"><h2 className="font-bold text-gray-800">Weekly Breakdown</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Week #','Week Of','Proj. Income','Proj. Expense','Bills Due','Net'].map((h, i) => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide ${i > 1 ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.forecast.map((w, i) => (
                      <tr key={w.week} className={`border-b border-gray-50 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                        <td className="px-4 py-3 font-medium text-gray-700">Week {w.week}</td>
                        <td className="px-4 py-3 text-gray-500">{w.label}</td>
                        <td className="px-4 py-3 text-right text-green-700 font-medium">{fmt(w.projected_income)}</td>
                        <td className="px-4 py-3 text-right text-red-600 font-medium">{fmt(w.projected_expense)}</td>
                        <td className="px-4 py-3 text-right text-amber-600 font-medium">{fmt(w.bills_due)}</td>
                        <td className="px-4 py-3 text-right"><NetCell value={Number(w.net)} /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                      <td className="px-4 py-3 text-gray-700" colSpan={2}>13-Week Totals</td>
                      <td className="px-4 py-3 text-right text-green-700">{fmt(totalIncome)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{fmt(totalExpense)}</td>
                      <td className="px-4 py-3 text-right text-amber-600">{fmt(totalBills)}</td>
                      <td className="px-4 py-3 text-right"><NetCell value={totalNet} /></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="font-bold text-gray-800 mb-1">Cumulative Cash Position</h2>
              <p className="text-xs text-gray-400 mb-4">Running net over 13 weeks</p>
              <CashFlowLine data={cumulativePoints} />
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 flex gap-4">
              <div className="w-8 h-8 rounded-full bg-[#0F4C81] text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">i</div>
              <div>
                <h3 className="font-semibold text-[#0F4C81] mb-1">Assumptions</h3>
                <p className="text-sm text-blue-800">Based on 90-day transaction history + active recurring transactions + upcoming bills. Projections are estimates — review weekly for accuracy.</p>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}