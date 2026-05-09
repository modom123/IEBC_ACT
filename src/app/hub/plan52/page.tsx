'use client'
import { useEffect, useState, useCallback } from 'react'

type WeekEntry = {
  id: string
  week_number: number
  year: number
  category: 'revenue' | 'operations' | 'marketing' | 'growth'
  goal: string
  status: 'planned' | 'in_progress' | 'complete' | 'missed'
  notes: string
}

const CATEGORY_STYLES: Record<string, string> = {
  revenue:    'bg-green-100 text-green-700',
  operations: 'bg-blue-100 text-blue-700',
  marketing:  'bg-purple-100 text-purple-700',
  growth:     'bg-orange-100 text-orange-700',
}

const STATUS_DOT: Record<string, string> = {
  planned:     'bg-blue-400',
  in_progress: 'bg-amber-400',
  complete:    'bg-green-500',
  missed:      'bg-red-500',
}

const QUARTERS = [
  { label: 'Q1', weeks: [1, 13] },
  { label: 'Q2', weeks: [14, 26] },
  { label: 'Q3', weeks: [27, 39] },
  { label: 'Q4', weeks: [40, 52] },
]

function getWeekDates(weekNum: number, year: number): string {
  const jan1 = new Date(year, 0, 1)
  const dayOfWeek = jan1.getDay()
  const start = new Date(jan1)
  start.setDate(jan1.getDate() + (weekNum - 1) * 7 - dayOfWeek + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

const emptyEntry = () => ({ category: 'revenue' as WeekEntry['category'], goal: '', status: 'planned' as WeekEntry['status'], notes: '' })

export default function Plan52Page() {
  const [entries, setEntries] = useState<WeekEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [quarter, setQuarter] = useState('Q1')
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)
  const [addForm, setAddForm] = useState(emptyEntry())
  const [savingWeek, setSavingWeek] = useState<number | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/hub/plan52?year=${year}`)
      const data = await res.json()
      setEntries(Array.isArray(data) ? data : [])
    } catch { setEntries([]) }
    setLoading(false)
  }, [year])

  useEffect(() => { load() }, [load])

  const qWeeks = QUARTERS.find(q => q.label === quarter)!.weeks
  const weekNums = Array.from({ length: qWeeks[1] - qWeeks[0] + 1 }, (_, i) => qWeeks[0] + i)

  const total = entries.length
  const completed = entries.filter(e => e.status === 'complete').length
  const inProgress = entries.filter(e => e.status === 'in_progress').length
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0

  async function addEntry(weekNum: number) {
    if (!addForm.goal.trim()) return
    setSavingWeek(weekNum)
    try {
      await fetch('/api/hub/plan52', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, week_number: weekNum, year }),
      })
      setAddForm(emptyEntry())
      await load()
    } finally { setSavingWeek(null) }
  }

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id)
    try {
      await fetch('/api/hub/plan52', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      await load()
    } finally { setUpdatingId(null) }
  }

  async function deleteEntry(id: string) {
    try {
      await fetch('/api/hub/plan52', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      await load()
    } catch { /* ignore */ }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">52-Week Plan</h1>
            <p className="text-sm text-gray-500 mt-0.5">Map your year — one week at a time</p>
          </div>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <button onClick={() => setYear(y => y - 1)} className="text-gray-400 hover:text-gray-700 font-bold px-1">‹</button>
            <span className="font-bold text-gray-800 w-12 text-center">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="text-gray-400 hover:text-gray-700 font-bold px-1">›</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Goals Set', value: total },
            { label: 'Completed', value: completed },
            { label: 'In Progress', value: inProgress },
            { label: 'Completion Rate', value: `${rate}%` },
          ].map(k => (
            <div key={k.label} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{k.label}</p>
              <p className="text-3xl font-bold text-[#0F4C81] mt-1">{k.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1 bg-white border border-gray-100 rounded-xl p-1.5 shadow-sm w-fit">
          {QUARTERS.map(q => (
            <button key={q.label} onClick={() => setQuarter(q.label)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${quarter === q.label ? 'bg-[#0F4C81] text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {q.label} <span className="text-xs opacity-70">Wk {q.weeks[0]}–{q.weeks[1]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {Array.from({ length: 13 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-3 animate-pulse h-20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {weekNums.map(weekNum => {
              const weekEntries = entries.filter(e => e.week_number === weekNum)
              const isExpanded = expandedWeek === weekNum
              const hasEntries = weekEntries.length > 0

              return (
                <div key={weekNum} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${isExpanded ? 'border-[#0F4C81]/30' : 'border-gray-100'}`}>
                  <button className="w-full text-left p-3" onClick={() => setExpandedWeek(isExpanded ? null : weekNum)}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-500 uppercase">Week {weekNum}</span>
                      <div className="flex gap-0.5">
                        {weekEntries.slice(0, 3).map(e => (
                          <span key={e.id} className={`w-2 h-2 rounded-full ${STATUS_DOT[e.status]}`} />
                        ))}
                        {!hasEntries && <span className="w-2 h-2 rounded-full bg-gray-200" />}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{getWeekDates(weekNum, year)}</p>
                    {hasEntries && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {weekEntries.map(e => (
                          <span key={e.id} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_STYLES[e.category]}`}>
                            {e.category.slice(0, 3)}
                          </span>
                        ))}
                      </div>
                    )}
                    {!hasEntries && <p className="text-xs text-gray-300 mt-1">+ Add goal</p>}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 p-3 space-y-2 bg-gray-50/60">
                      {weekEntries.map(e => (
                        <div key={e.id} className="bg-white rounded-lg border border-gray-100 p-2.5 space-y-1.5">
                          <div className="flex items-start justify-between gap-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${CATEGORY_STYLES[e.category]}`}>{e.category}</span>
                            <button onClick={() => deleteEntry(e.id)} className="text-gray-300 hover:text-red-400 text-xs">✕</button>
                          </div>
                          <p className="text-xs text-gray-700 font-medium">{e.goal}</p>
                          <div className="flex gap-1 flex-wrap">
                            {['planned', 'in_progress', 'complete', 'missed'].map(s => (
                              <button key={s} onClick={() => updateStatus(e.id, s)} disabled={updatingId === e.id}
                                className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${e.status === s ? STATUS_DOT[s].replace('bg-', 'bg-') + ' text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'} ${e.status === s ? 'opacity-100' : ''}`}
                                style={e.status === s ? { background: s === 'complete' ? '#22c55e' : s === 'in_progress' ? '#f59e0b' : s === 'missed' ? '#ef4444' : '#60a5fa', color: 'white' } : {}}>
                                {s === 'in_progress' ? 'active' : s}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="space-y-2 pt-1">
                        <select value={addForm.category} onChange={e => setAddForm(p => ({ ...p, category: e.target.value as WeekEntry['category'] }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#0F4C81]/30 bg-white">
                          <option value="revenue">Revenue</option>
                          <option value="operations">Operations</option>
                          <option value="marketing">Marketing</option>
                          <option value="growth">Growth</option>
                        </select>
                        <input type="text" placeholder="Goal for this week…" value={addForm.goal}
                          onChange={e => setAddForm(p => ({ ...p, goal: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#0F4C81]/30" />
                        <button onClick={() => addEntry(weekNum)} disabled={savingWeek === weekNum || !addForm.goal.trim()}
                          className="w-full bg-[#0F4C81] text-white rounded-lg py-1.5 text-xs font-medium hover:bg-[#0d3d6b] disabled:opacity-50 transition-colors">
                          {savingWeek === weekNum ? 'Adding…' : '+ Add Goal'}
                        </button>
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
