'use client'

import { useState, useEffect, useCallback } from 'react'
import AccountingShell from '@/components/AccountingShell'

type Employee = {
  id: string
  name: string
  email: string | null
  title: string | null
  pay_type: 'hourly' | 'salary'
  pay_rate: number
  filing_status: string
  allowances: number
  status: 'active' | 'inactive'
}

type PayRun = {
  id: string
  period_start: string
  period_end: string
  pay_date: string
  total_gross: number
  total_taxes: number
  total_net: number
  employee_count: number
  status: string
}

type PayStub = {
  employee_id: string
  employee_name: string
  gross_pay: number
  federal_tax: number
  state_tax: number
  social_security: number
  medicare: number
  net_pay: number
  hours?: number
}

const fmt = (n: number) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const today = () => new Date().toISOString().split('T')[0]

function calcTaxes(gross: number, filing: string, allowances: number): Omit<PayStub, 'employee_id' | 'employee_name' | 'gross_pay' | 'hours'> {
  const allowanceAmt = allowances * 87.5
  const taxable = Math.max(0, gross - allowanceAmt)
  const federalRate = filing === 'married' ? 0.12 : 0.15
  const federal_tax  = +(taxable * federalRate).toFixed(2)
  const state_tax    = +(gross * 0.04).toFixed(2)
  const social_security = +(gross * 0.062).toFixed(2)
  const medicare     = +(gross * 0.0145).toFixed(2)
  const net_pay      = +(gross - federal_tax - state_tax - social_security - medicare).toFixed(2)
  return { federal_tax, state_tax, social_security, medicare, net_pay }
}

const emptyEmpForm = { name: '', email: '', title: '', pay_type: 'hourly' as const, pay_rate: '', filing_status: 'single', allowances: '1' }

export default function PayrollPage() {
  const [tab,       setTab]       = useState<'run' | 'employees' | 'history'>('run')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [runs,      setRuns]      = useState<PayRun[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showEmpForm, setShowEmpForm] = useState(false)
  const [savingEmp,   setSavingEmp]   = useState(false)
  const [empForm,     setEmpForm]     = useState(emptyEmpForm)
  const [empError,    setEmpError]    = useState('')

  // Payroll run state
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]
  })
  const [periodEnd, setPeriodEnd] = useState(() => {
    const d = new Date(); d.setDate(15); return d.toISOString().split('T')[0]
  })
  const [payDate, setPayDate]       = useState(today)
  const [hours,   setHours]         = useState<Record<string, string>>({})
  const [running, setRunning]       = useState(false)
  const [runSuccess, setRunSuccess] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [empRes, runRes] = await Promise.all([
        fetch('/api/accounting/payroll?type=employees'),
        fetch('/api/accounting/payroll?type=runs'),
      ])
      const empData = await empRes.json()
      const runData = await runRes.json()
      setEmployees(empData.employees || [])
      setRuns(runData.runs || [])
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function addEmployee(e: React.FormEvent) {
    e.preventDefault()
    if (!empForm.name || !empForm.pay_rate) { setEmpError('Name and pay rate are required.'); return }
    setSavingEmp(true); setEmpError('')
    try {
      const res = await fetch('/api/accounting/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_employee', ...empForm, pay_rate: parseFloat(empForm.pay_rate), allowances: parseInt(empForm.allowances) }),
      })
      const data = await res.json()
      if (data.error) { setEmpError(data.error); return }
      setEmployees(prev => [...prev, data.employee])
      setEmpForm(emptyEmpForm); setShowEmpForm(false)
    } finally { setSavingEmp(false) }
  }

  async function toggleStatus(emp: Employee) {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active'
    setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: newStatus } : e))
    await fetch('/api/accounting/payroll', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: emp.id, status: newStatus }),
    })
  }

  function buildStubs(): PayStub[] {
    return employees.filter(e => e.status === 'active').map(emp => {
      let gross = 0
      if (emp.pay_type === 'salary') {
        const start = new Date(periodStart), end = new Date(periodEnd)
        const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1
        gross = +(emp.pay_rate / 365 * days).toFixed(2)
      } else {
        const hrs = parseFloat(hours[emp.id] || '0')
        gross = +(hrs * emp.pay_rate).toFixed(2)
      }
      const taxes = calcTaxes(gross, emp.filing_status, emp.allowances)
      return {
        employee_id: emp.id,
        employee_name: emp.name,
        gross_pay: gross,
        hours: emp.pay_type === 'hourly' ? parseFloat(hours[emp.id] || '0') : undefined,
        ...taxes,
      }
    })
  }

  const stubs = buildStubs()
  const totalGross = stubs.reduce((s, st) => s + st.gross_pay, 0)
  const totalNet   = stubs.reduce((s, st) => s + st.net_pay, 0)
  const totalTaxes = stubs.reduce((s, st) => s + st.federal_tax + st.state_tax + st.social_security + st.medicare, 0)

  async function runPayroll() {
    if (stubs.length === 0) return
    setRunning(true)
    try {
      const res = await fetch('/api/accounting/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_payroll', stubs, period_start: periodStart, period_end: periodEnd, pay_date: payDate }),
      })
      const data = await res.json()
      if (data.error) { alert(data.error); return }
      setRunSuccess(true)
      await load()
      setTimeout(() => { setRunSuccess(false); setTab('history') }, 1800)
    } finally { setRunning(false) }
  }

  const activeEmp = employees.filter(e => e.status === 'active')

  return (
    <AccountingShell>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Payroll</h1>
            <p className="text-sm text-gray-400 mt-0.5">{activeEmp.length} active employee{activeEmp.length !== 1 ? 's' : ''} · automated tax withholding</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setTab('run')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'run' ? 'bg-[#0F4C81] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#0F4C81]'}`}>▷ Run Payroll</button>
            <button onClick={() => setTab('employees')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'employees' ? 'bg-[#0F4C81] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#0F4C81]'}`}>Employees</button>
            <button onClick={() => setTab('history')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${tab === 'history' ? 'bg-[#0F4C81] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#0F4C81]'}`}>History</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Employees', value: String(activeEmp.length), color: 'text-[#0F4C81]' },
            { label: 'Pay Runs YTD',     value: String(runs.length),      color: 'text-gray-700' },
            { label: 'Gross Paid YTD',   value: fmt(runs.reduce((s, r) => s + Number(r.total_gross), 0)), color: 'text-green-700' },
            { label: 'Taxes Withheld',   value: fmt(runs.reduce((s, r) => s + Number(r.total_taxes), 0)), color: 'text-orange-600' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{c.label}</p>
              <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* ── RUN PAYROLL TAB ── */}
        {tab === 'run' && (
          <div className="space-y-4">
            {activeEmp.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
                <p className="text-gray-400 mb-3 text-sm">No active employees. Add employees first.</p>
                <button onClick={() => setTab('employees')} className="px-5 py-2 bg-[#0F4C81] text-white text-sm font-semibold rounded-lg hover:bg-[#082D4F] transition">Go to Employees →</button>
              </div>
            ) : (
              <>
                {/* Period Setup */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h2 className="font-bold text-gray-800 mb-4">Pay Period</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Period Start</label>
                      <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Period End</label>
                      <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Pay Date</label>
                      <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                    </div>
                  </div>
                </div>

                {/* Pay Stubs Preview */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h2 className="font-bold text-gray-800">Pay Preview</h2>
                    <p className="text-xs text-gray-400 mt-0.5">Taxes calculated automatically · enter hours for hourly employees</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-400 uppercase border-b border-gray-100">
                          <th className="px-4 py-2.5 text-left font-medium">Employee</th>
                          <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Type</th>
                          <th className="px-4 py-2.5 text-right font-medium">Hours / Period</th>
                          <th className="px-4 py-2.5 text-right font-medium">Gross</th>
                          <th className="px-4 py-2.5 text-right font-medium hidden lg:table-cell">Fed Tax</th>
                          <th className="px-4 py-2.5 text-right font-medium hidden lg:table-cell">FICA</th>
                          <th className="px-4 py-2.5 text-right font-medium">Net Pay</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {activeEmp.map(emp => {
                          const stub = stubs.find(s => s.employee_id === emp.id)
                          if (!stub) return null
                          const fica = (stub.social_security + stub.medicare)
                          return (
                            <tr key={emp.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                <p className="font-medium text-gray-800">{emp.name}</p>
                                {emp.title && <p className="text-xs text-gray-400">{emp.title}</p>}
                              </td>
                              <td className="px-4 py-3 hidden md:table-cell">
                                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-500 capitalize">{emp.pay_type}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                {emp.pay_type === 'hourly' ? (
                                  <input type="number" min="0" step="0.5" value={hours[emp.id] || ''} onChange={e => setHours(p => ({ ...p, [emp.id]: e.target.value }))} placeholder="0" className="w-20 border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-[#0F4C81]" />
                                ) : (
                                  <span className="text-xs text-gray-400">Salary</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right font-mono text-gray-800 font-semibold">{fmt(stub.gross_pay)}</td>
                              <td className="px-4 py-3 text-right font-mono text-red-500 text-xs hidden lg:table-cell">{fmt(stub.federal_tax + stub.state_tax)}</td>
                              <td className="px-4 py-3 text-right font-mono text-red-500 text-xs hidden lg:table-cell">{fmt(fica)}</td>
                              <td className="px-4 py-3 text-right font-mono font-bold text-green-700">{fmt(stub.net_pay)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-50 border-t border-gray-200 font-bold">
                          <td colSpan={3} className="px-4 py-2.5 text-xs uppercase text-gray-500">Totals</td>
                          <td className="px-4 py-2.5 text-right font-mono text-gray-800">{fmt(totalGross)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-red-500 text-xs hidden lg:table-cell">{fmt(totalTaxes)}</td>
                          <td className="hidden lg:table-cell" />
                          <td className="px-4 py-2.5 text-right font-mono text-green-700">{fmt(totalNet)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
                    <div className="text-sm text-gray-500">
                      Total payout: <span className="font-bold text-gray-800">{fmt(totalNet)}</span>
                      <span className="mx-2 text-gray-300">|</span>
                      Tax obligations: <span className="font-bold text-red-600">{fmt(totalTaxes)}</span>
                    </div>
                    <button onClick={runPayroll} disabled={running || runSuccess || totalGross === 0}
                      className="px-6 py-2 bg-[#0F4C81] hover:bg-[#082D4F] text-white text-sm font-bold rounded-lg transition disabled:opacity-50 flex items-center gap-2">
                      {runSuccess ? '✓ Payroll Processed!' : running ? 'Processing…' : '▷ Process Payroll'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── EMPLOYEES TAB ── */}
        {tab === 'employees' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={() => setShowEmpForm(v => !v)}
                className="px-4 py-2 bg-[#0F4C81] hover:bg-[#082D4F] text-white text-sm font-semibold rounded-lg transition">
                + Add Employee
              </button>
            </div>

            {showEmpForm && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <h2 className="font-bold text-gray-800 mb-4">New Employee</h2>
                {empError && <p className="text-red-600 text-sm mb-3">{empError}</p>}
                <form onSubmit={addEmployee} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Full Name *</label>
                    <input value={empForm.name} onChange={e => setEmpForm(p => ({ ...p, name: e.target.value }))} placeholder="Jane Doe" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                    <input type="email" value={empForm.email} onChange={e => setEmpForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Job Title</label>
                    <input value={empForm.title} onChange={e => setEmpForm(p => ({ ...p, title: e.target.value }))} placeholder="Designer" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Pay Type</label>
                    <select value={empForm.pay_type} onChange={e => setEmpForm(p => ({ ...p, pay_type: e.target.value as 'hourly' | 'salary' }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]">
                      <option value="hourly">Hourly</option>
                      <option value="salary">Salary (Annual)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{empForm.pay_type === 'hourly' ? 'Hourly Rate ($)' : 'Annual Salary ($)'} *</label>
                    <input type="number" step="0.01" value={empForm.pay_rate} onChange={e => setEmpForm(p => ({ ...p, pay_rate: e.target.value }))} placeholder="0.00" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Filing Status</label>
                    <select value={empForm.filing_status} onChange={e => setEmpForm(p => ({ ...p, filing_status: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F4C81]">
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="head_of_household">Head of Household</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
                    <button type="submit" disabled={savingEmp} className="px-5 py-2 bg-[#0F4C81] hover:bg-[#082D4F] text-white text-sm font-semibold rounded-lg transition disabled:opacity-50">
                      {savingEmp ? 'Saving…' : 'Add Employee'}
                    </button>
                    <button type="button" onClick={() => setShowEmpForm(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {loading ? <div className="text-center py-8 text-gray-400 text-sm">Loading…</div> : employees.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
                <p className="text-gray-400 text-sm mb-3">No employees added yet.</p>
                <button onClick={() => setShowEmpForm(true)} className="px-5 py-2 bg-[#0F4C81] text-white text-sm font-semibold rounded-lg hover:bg-[#082D4F] transition">+ Add First Employee</button>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-400 uppercase border-b border-gray-100">
                        <th className="px-4 py-3 text-left font-medium">Employee</th>
                        <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Pay Type</th>
                        <th className="px-4 py-3 text-right font-medium">Rate</th>
                        <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Filing</th>
                        <th className="px-4 py-3 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {employees.map(emp => (
                        <tr key={emp.id} className={`hover:bg-gray-50 ${emp.status === 'inactive' ? 'opacity-50' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-800">{emp.name}</p>
                            {emp.title && <p className="text-xs text-gray-400">{emp.title}</p>}
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="px-2 py-0.5 bg-gray-100 rounded text-xs capitalize">{emp.pay_type}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-gray-800">
                            {fmt(emp.pay_rate)}{emp.pay_type === 'hourly' ? '/hr' : '/yr'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 capitalize hidden lg:table-cell">{emp.filing_status.replace('_', ' ')}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => toggleStatus(emp)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${emp.status === 'active' ? 'bg-[#0F4C81]' : 'bg-gray-200'}`}>
                              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${emp.status === 'active' ? 'translate-x-4' : 'translate-x-1'}`} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div className="space-y-4">
            {runs.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
                <p className="text-gray-400 text-sm">No pay runs yet. Run payroll to see history here.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-400 uppercase border-b border-gray-100">
                        <th className="px-4 py-3 text-left font-medium">Pay Period</th>
                        <th className="px-4 py-3 text-left font-medium">Pay Date</th>
                        <th className="px-4 py-3 text-right font-medium hidden md:table-cell">Employees</th>
                        <th className="px-4 py-3 text-right font-medium">Gross</th>
                        <th className="px-4 py-3 text-right font-medium hidden lg:table-cell">Taxes</th>
                        <th className="px-4 py-3 text-right font-medium">Net Paid</th>
                        <th className="px-4 py-3 text-center font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {runs.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700">{r.period_start} – {r.period_end}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{r.pay_date}</td>
                          <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">{r.employee_count}</td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-gray-800">{fmt(r.total_gross)}</td>
                          <td className="px-4 py-3 text-right font-mono text-red-500 text-sm hidden lg:table-cell">{fmt(r.total_taxes)}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-green-700">{fmt(r.total_net)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold capitalize">{r.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t border-gray-200">
                        <td colSpan={3} className="px-4 py-2.5 text-xs font-bold text-gray-500 uppercase">YTD Totals</td>
                        <td className="px-4 py-2.5 text-right font-bold text-gray-800">{fmt(runs.reduce((s, r) => s + Number(r.total_gross), 0))}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-red-500 hidden lg:table-cell">{fmt(runs.reduce((s, r) => s + Number(r.total_taxes), 0))}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-green-700">{fmt(runs.reduce((s, r) => s + Number(r.total_net), 0))}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tax disclaimer */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700">
          <strong>Tax Estimates:</strong> Tax calculations are estimates for planning purposes only. Federal (15%/12% married), state (4%), Social Security (6.2%), Medicare (1.45%). Consult a payroll provider or CPA for official payroll processing and IRS compliance.
        </div>
      </div>
    </AccountingShell>
  )
}
